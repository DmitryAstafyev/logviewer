use crate::traits::{error, source};
use async_trait::async_trait;
use bytes::BytesMut;
use encoding_rs_io::*;
use std::{
    fs::File,
    io::{BufRead, BufReader, Read},
    path::PathBuf,
};
use thiserror::Error as ThisError;
use tokio::{
    join, select,
    sync::{
        mpsc::{unbounded_channel, UnboundedReceiver, UnboundedSender},
        oneshot,
    },
};
use tokio_util::sync::CancellationToken;

const READ_BUFFER_SIZE: usize = 100 * 1024;

#[derive(ThisError, Debug, Clone)]
pub enum Error {
    #[error("Input file doesn't exist")]
    NoFile,
    #[error("IO error: {0}")]
    Io(String),
    #[error("Method next called multiple times")]
    MultipleChunkRequest,
    #[error("Attempt to pass chunks multiple times")]
    MultipleChunkPassed,
    #[error("Channel error: {0}")]
    Channel(String),
    #[error("API already in use")]
    AlreadyInUse,
    #[error("This source doesn't support write operations")]
    NotWritableSource,
    #[error("Fail to confirm recieving of chunk")]
    ChunkIsNotConfirmed,
    #[error("Fail to confirm a chunk")]
    FailChunkConfirmation,
}

impl error::Error for Error {}

#[derive(Clone, Debug)]
pub struct Options {
    pub path: PathBuf,
    pub buffer_size: usize,
}

#[derive(Debug)]
pub enum APIEvent {
    Chunk(Vec<u8>, oneshot::Sender<bool>),
    NextChunk(oneshot::Sender<Option<Vec<u8>>>),
    GetOptions(oneshot::Sender<Options>),
    Shutdown(oneshot::Sender<()>),
}

#[derive(Clone)]
pub struct API {
    tx_api: UnboundedSender<APIEvent>,
}

impl API {
    pub fn new(tx_api: UnboundedSender<APIEvent>) -> Self {
        Self { tx_api }
    }
}

#[async_trait]
impl source::API<Error> for API {
    async fn close(&self) -> Result<(), Error> {
        Ok(())
    }

    async fn next(&self) -> Option<Vec<u8>> {
        let (tx_response, rx_response): (
            oneshot::Sender<Option<Vec<u8>>>,
            oneshot::Receiver<Option<Vec<u8>>>,
        ) = oneshot::channel();
        if self.tx_api.send(APIEvent::NextChunk(tx_response)).is_err() {
            None
        } else {
            match rx_response.await {
                Ok(event) => event,
                Err(_) => None,
            }
        }
    }
    async fn write(&self, _data: &[u8]) -> Result<(), Error> {
        Err(Error::NotWritableSource)
    }

    fn writable(&self) -> bool {
        false
    }

    async fn get_source_file(&self) -> Result<PathBuf, Error> {
        let (tx_response, rx_response): (oneshot::Sender<Options>, oneshot::Receiver<Options>) =
            oneshot::channel();
        if let Err(err) = self.tx_api.send(APIEvent::GetOptions(tx_response)) {
            Err(Error::Channel(format!(
                "fail request options; error: {}",
                err
            )))
        } else {
            let options = rx_response
                .await
                .map_err(|_| Error::Channel(String::from("Fail to get option response")))?;
            Ok(options.path)
        }
    }

    async fn shutdown(&self) -> Result<(), Error> {
        let (tx_response, rx_response): (oneshot::Sender<()>, oneshot::Receiver<()>) =
            oneshot::channel();
        if let Err(err) = self.tx_api.send(APIEvent::Shutdown(tx_response)) {
            Err(Error::Channel(format!(
                "fail send shutdown request; error: {}",
                err
            )))
        } else {
            rx_response
                .await
                .map_err(|_| Error::Channel(String::from("Fail to get shutdown response")))
        }
    }
}

pub struct Source {
    tx_api: UnboundedSender<APIEvent>,
    rx_api: Option<UnboundedReceiver<APIEvent>>,
    cancel: CancellationToken,
}

impl Source {
    pub fn new() -> Self {
        let (tx_api, rx_api): (UnboundedSender<APIEvent>, UnboundedReceiver<APIEvent>) =
            unbounded_channel();
        Self {
            tx_api,
            rx_api: Some(rx_api),
            cancel: CancellationToken::new(),
        }
    }

    async fn read_task(
        &self,
        mut file: File,
        options: &Options,
        tx_api: UnboundedSender<APIEvent>,
    ) -> Result<(), Error> {
        let mut read: usize = 0;
        while !self.cancel.is_cancelled() {
            // let decoder = DecodeReaderBytesBuilder::new()
            //     .utf8_passthru(true)
            //     .strip_bom(true)
            //     .bom_override(true)
            //     .bom_sniffing(true)
            //     .build(chunk);
            // let mut reader = BufReader::new(decoder);
            let mut buffer = [0; READ_BUFFER_SIZE];
            let buffer_len = file
                .read(&mut buffer)
                .map_err(|e| Error::Io(e.to_string()))?;
            read += buffer.len();
            println!(">>>>>>>>>>>>>>>> read: {} Mb", read / 1024 / 1024);
            if !buffer.is_empty() {
                let (tx_confirm, rx_confirm): (oneshot::Sender<bool>, oneshot::Receiver<bool>) =
                    oneshot::channel();
                tx_api
                    .send(APIEvent::Chunk(buffer.to_vec(), tx_confirm))
                    .map_err(|e| {
                        Error::Channel(format!("fail to trigger \"APIEvent::Chunk\": {}", e))
                    })?;
                rx_confirm.await.map_err(|_| Error::ChunkIsNotConfirmed)?;
            }
            if buffer_len < READ_BUFFER_SIZE {
                println!(
                    ">>>>>>>>>>>>>>> EXIT FROM FILE-SOURCE: {}/{}",
                    buffer_len, READ_BUFFER_SIZE
                );
                // TODO: we should wait... tail functionality
                break;
            }
        }
        Ok(())
    }

    async fn api_task(
        &self,
        options: &Options,
        mut rx_api: UnboundedReceiver<APIEvent>,
    ) -> Result<(), Error> {
        let mut pending_responser: Option<oneshot::Sender<Option<Vec<u8>>>> = None;
        let mut pending_chunk: Option<(Option<Vec<u8>>, oneshot::Sender<bool>)> = None;
        while let Some(event) = select! {
            event = rx_api.recv() => event,
            _ = self.cancel.cancelled() => None
        } {
            match event {
                APIEvent::Chunk(chunk, tx_confirm) => {
                    if pending_chunk.is_some() {
                        return Err(Error::MultipleChunkPassed);
                    }
                    if let Some(tx_response) = pending_responser.take() {
                        if tx_response.send(Some(chunk)).is_err() {
                            tx_confirm
                                .send(false)
                                .map_err(|_| Error::FailChunkConfirmation)?;
                            return Err(Error::Channel(String::from(
                                "Fail to response for \"APIEvent::NextEvent\" from \"APIEvent::Chunk\"",
                            )));
                        } else {
                            tx_confirm
                                .send(true)
                                .map_err(|_| Error::FailChunkConfirmation)?;
                        }
                    } else {
                        pending_chunk = Some((Some(chunk), tx_confirm));
                    }
                }
                APIEvent::NextChunk(tx_response) => {
                    if pending_responser.is_some() {
                        return Err(Error::MultipleChunkRequest);
                    }
                    if let Some((chunk, tx_confirm)) = pending_chunk.take() {
                        if tx_response.send(chunk).is_err() {
                            tx_confirm
                                .send(false)
                                .map_err(|_| Error::FailChunkConfirmation)?;
                            return Err(Error::Channel(String::from(
                                "Fail to response for \"APIEvent::NextChunk\"",
                            )));
                        } else {
                            tx_confirm
                                .send(true)
                                .map_err(|_| Error::FailChunkConfirmation)?;
                        }
                    } else {
                        pending_responser = Some(tx_response);
                    }
                }
                APIEvent::Shutdown(tx_response) => {
                    self.cancel.cancel();
                    if tx_response.send(()).is_err() {
                        return Err(Error::Channel(String::from(
                            "Fail to response for \"APIEvent::Shutdown\"",
                        )));
                    }
                }
                APIEvent::GetOptions(tx_response) => {
                    if tx_response.send(options.clone()).is_err() {
                        return Err(Error::Channel(String::from(
                            "Fail to response for \"APIEvent::GetOptions\"",
                        )));
                    }
                }
            }
        }
        Ok(())
    }
}

#[async_trait]
impl source::Source<Options, Error, API> for Source {
    async fn open(&mut self, options: Options) -> Result<(), Error> {
        if !options.path.exists() {
            return Err(Error::NoFile);
        }
        let rx_api = if let Some(rx_api) = self.rx_api.take() {
            rx_api
        } else {
            return Err(Error::AlreadyInUse);
        };
        let file = File::open(&options.path).map_err(|e| Error::Io(e.to_string()))?;
        let (reader_task_res, api_task_res) = join!(
            async {
                let result = self.read_task(file, &options, self.tx_api.clone()).await;
                self.cancel.cancel();
                result
            },
            async {
                let result = self.api_task(&options, rx_api).await;
                self.cancel.cancel();
                result
            },
        );
        println!(">>>>> {:?}", reader_task_res);
        println!(">>>>> {:?}", api_task_res);
        if reader_task_res.is_err() {
            reader_task_res
        } else if api_task_res.is_err() {
            api_task_res
        } else {
            Ok(())
        }
    }

    fn get_api(&self) -> API {
        API::new(self.tx_api.clone())
    }
}
