use crate::{
    socket::ReconnectStateMsg, ByteSource, Error as SourceError, ReloadInfo, SourceFilter,
};
use bufread::DeqBuffer;
use tokio::{net::TcpStream, task::yield_now};

use super::{
    handle_buff_capacity, BuffCapacityState, ReconnectInfo, ReconnectResult, ReconnectToServer,
    MAX_BUFF_SIZE, MAX_DATAGRAM_SIZE,
};

pub struct TcpSource {
    buffer: DeqBuffer,
    socket: TcpStream,
    tmp_buffer: Vec<u8>,
    binding_address: String,
    reconnect_info: Option<ReconnectInfo>,
}

impl TcpSource {
    pub async fn new<A: Into<String>>(
        addr: A,
        reconnect_info: Option<ReconnectInfo>,
    ) -> Result<Self, std::io::Error> {
        let binding_address: String = addr.into();
        Ok(Self {
            buffer: DeqBuffer::new(MAX_BUFF_SIZE),
            socket: TcpStream::connect(&binding_address).await?,
            tmp_buffer: vec![0u8; MAX_DATAGRAM_SIZE],
            binding_address,
            reconnect_info,
        })
    }
}

impl ReconnectToServer for TcpSource {
    async fn reconnect(&mut self) -> ReconnectResult {
        let Some(reconnect_info) = self.reconnect_info.as_ref() else {
            log::debug!("No reconnect info provided. Skipping reconnecting");
            return ReconnectResult::NotConfigured;
        };

        if let Some(sender) = &reconnect_info.state_sender {
            sender.send_replace(ReconnectStateMsg::Reconnecting { attempts: 0 });
            // Give receivers a chance to get the initial reconnecting state before sending
            // the first attempt update.
            yield_now().await;
        }

        let mut attempts = 0;
        loop {
            attempts += 1;
            if let Some(sender) = &reconnect_info.state_sender {
                sender.send_replace(ReconnectStateMsg::Reconnecting { attempts });
            }
            log::info!("Reconnecting to TCP server. Attempt: {attempts}");
            tokio::time::sleep(reconnect_info.interval).await;

            match TcpStream::connect(&self.binding_address).await {
                Ok(socket) => {
                    self.socket = socket;

                    if let Some(sender) = &reconnect_info.state_sender {
                        if let Err(err) = sender.send(ReconnectStateMsg::Connected) {
                            log::error!("Failed to send connected state with err: {err}");
                        }
                    }
                    return ReconnectResult::Reconnected;
                }
                Err(err) => {
                    log::debug!("Got following error while trying to reconnect: {err}");
                    if attempts >= reconnect_info.max_attempts {
                        if let Some(sender) = &reconnect_info.state_sender {
                            sender.send_replace(ReconnectStateMsg::Failed {
                                attempts,
                                err_msg: Some(err.to_string()),
                            });
                            // Make sure the message has been sent before returning.
                            yield_now().await;
                        }
                        log::warn!("Reconnecting to TCP server failed after {attempts} attemps.");

                        return ReconnectResult::Error(err);
                    }
                }
            }
        }
    }
}

impl ByteSource for TcpSource {
    async fn load(
        &mut self,
        _filter: Option<&SourceFilter>,
    ) -> Result<Option<ReloadInfo>, SourceError> {
        // If buffer is almost full then skip loading and return the available bytes.
        // This can happen because some parsers will parse the first item of the provided slice
        // while the producer will call load on each iteration making data accumulate.
        match handle_buff_capacity(&mut self.buffer) {
            BuffCapacityState::CanLoad => {}
            BuffCapacityState::AlmostFull => {
                let available_bytes = self.len();
                return Ok(Some(ReloadInfo::new(0, available_bytes, 0, None)));
            }
        }

        // TODO use filter
        loop {
            debug!("Wait for tcp socket to become readable");
            self.socket
                .readable()
                .await
                .map_err(|e| SourceError::Unrecoverable(format!("{e}")))?;
            debug!("Socket ready to read");
            match self.socket.try_read(&mut self.tmp_buffer) {
                Ok(len) => {
                    trace!("---> Received {} bytes", len);
                    if len == 0 {
                        // No data were received -> Server may be temporally down
                        // then try to reconnect.
                        match self.reconnect().await {
                            ReconnectResult::Reconnected => continue,
                            ReconnectResult::NotConfigured => {}
                            ReconnectResult::Error(error) => {
                                return Err(SourceError::Unrecoverable(error.to_string()));
                            }
                        };
                    }
                    let added = self.buffer.write_from(&self.tmp_buffer[..len]);
                    if added < len {
                        return Err(SourceError::Unrecoverable(format!(
                            "Internal buffer maximum capcity reached.\
                            Read from socekt: {len}, Copied to buffer: {added}"
                        )));
                    }
                    let available_bytes = self.buffer.read_available();

                    return Ok(Some(ReloadInfo::new(added, available_bytes, 0, None)));
                }
                Err(ref e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                    continue;
                }
                Err(e) => {
                    // Server may be temporally down -> Try to reconnect.
                    match self.reconnect().await {
                        ReconnectResult::Reconnected => {
                            continue;
                        }
                        ReconnectResult::NotConfigured => {
                            // Continue with the original error.
                            return Err(SourceError::Setup(format!("{e}")));
                        }
                        ReconnectResult::Error(err) => {
                            // return both errors.
                            return Err(SourceError::Setup(format!(
                                " Reconnection failed with error: {e}.\
                                \nAfter recieving original error: {err}"
                            )));
                        }
                    };
                }
            }
        }
        // let len = self
        //     .socket
        //     .try_read(&mut self.tmp_buffer)
        //     .map_err(|e| SourceError::Setup(format!("{}", e)))?;
    }

    fn current_slice(&self) -> &[u8] {
        self.buffer.read_slice()
    }

    fn consume(&mut self, offset: usize) {
        self.buffer.read_done(offset);
    }

    fn len(&self) -> usize {
        self.buffer.read_available()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    use crate::tests::general_source_reload_test;
    use std::time::Duration;
    use tokio::{io::AsyncWriteExt, net::TcpListener, time::sleep};

    static MESSAGES: &[&str] = &["one", "two", "three"];

    #[tokio::test]
    async fn test_tcp_reload() -> Result<(), std::io::Error> {
        static SERVER: &str = "127.0.0.1:4000";
        let listener = TcpListener::bind(&SERVER).await.unwrap();
        // process_socket(socket).await;
        // let send_socket = TcpSocket::bind(SENDER).await?;
        let send_handle = tokio::spawn(async move {
            let (stream, _) = listener.accept().await.unwrap();
            let (_, mut send) = tokio::io::split(stream);
            // stream.writable().await.unwrap();
            for msg in MESSAGES {
                send.write_all(msg.as_bytes())
                    .await
                    .expect("could not send on socket");
                send.flush().await.expect("flush message should work");
                sleep(Duration::from_millis(100)).await;
            }
        });
        let mut tcp_source = TcpSource::new(SERVER, None).await?;
        let receive_handle = tokio::spawn(async move {
            for msg in MESSAGES {
                tcp_source.load(None).await.expect("reload failed");
                println!(
                    "receive: {:02X?}",
                    std::str::from_utf8(tcp_source.current_slice())
                );
                assert_eq!(tcp_source.current_slice(), msg.as_bytes());
                tcp_source.consume(msg.len());
            }
        });

        println!("TCP: Starting send and receive");
        let (_, rec_res) = tokio::join!(send_handle, receive_handle,);

        assert!(rec_res.is_ok());
        Ok(())
    }

    #[tokio::test]
    async fn test_general_source_reload() {
        static SERVER: &str = "127.0.0.1:4001";
        let listener = TcpListener::bind(&SERVER).await.unwrap();
        // process_socket(socket).await;
        // let send_socket = TcpSocket::bind(SENDER).await?;
        tokio::spawn(async move {
            let (stream, _) = listener.accept().await.unwrap();
            let (_, mut send) = tokio::io::split(stream);
            // stream.writable().await.unwrap();
            for msg in MESSAGES {
                send.write_all(msg.as_bytes())
                    .await
                    .expect("could not send on socket");
                send.flush().await.expect("flush message should work");
                sleep(Duration::from_millis(100)).await;
            }
        });
        let mut tcp_source = TcpSource::new(SERVER, None).await.unwrap();

        general_source_reload_test(&mut tcp_source).await;
    }

    /// Tests will send packets with fixed lengths while consuming
    /// half of the sent length, ensuring the source won't break.
    #[tokio::test]
    async fn test_source_buffer_overflow() {
        const SERVER: &str = "127.0.0.1:4002";
        let listener = TcpListener::bind(&SERVER).await.unwrap();

        const SENT_LEN: usize = MAX_DATAGRAM_SIZE;
        const CONSUME_LEN: usize = MAX_DATAGRAM_SIZE / 2;

        tokio::spawn(async move {
            let (stream, _) = listener.accept().await.unwrap();
            let (_, mut send) = tokio::io::split(stream);
            let msg = [b'a'; SENT_LEN];
            let mut total_sent = 0;
            while total_sent < MAX_BUFF_SIZE * 2 {
                send.write_all(&msg)
                    .await
                    .expect("could not send on socket");
                send.flush().await.expect("flush message should work");
                yield_now().await;
                total_sent += msg.len();
            }
        });

        let mut tcp_source = TcpSource::new(SERVER, None).await.unwrap();

        while let Ok(Some(info)) = tcp_source.load(None).await {
            if info.available_bytes == 0 {
                break;
            }
            tcp_source.consume(info.available_bytes.min(CONSUME_LEN));
        }
    }
}
