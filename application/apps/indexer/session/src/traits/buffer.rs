use crate::traits::{error, map, map::Map, parser, parser::Parser, source, source::Source};
use bytes::BytesMut;
use std::{fs, io, ops::Range, path::PathBuf, str::Utf8Error};
use thiserror::Error as ThisError;
use tokio::{
    fs::File,
    io::{AsyncReadExt, AsyncSeekExt, AsyncWriteExt, SeekFrom},
    join, select,
    sync::{
        mpsc::{unbounded_channel, UnboundedReceiver, UnboundedSender},
        oneshot,
    },
};
use tokio_util::sync::CancellationToken;
use uuid::Uuid;

#[derive(ThisError, Debug)]
pub enum Error {
    #[error("Source error: {0}")]
    SourceError(String),
    #[error("Parsing error: {0}")]
    Parsing(String),
    #[error("Converting into string error: {0}")]
    UTF8String(Utf8Error),
    #[error("Channel error: {0}")]
    Channel(String),
    #[error("Responsing error: {0}")]
    Responsing(String),
    #[error("API already in use")]
    AlreadyInUse,
    #[error("Buffer event cannot be requested frop multiple points")]
    MultipleEventRequest,
    #[error("No range found")]
    NoRange,
    #[error("No output file")]
    NoOutputFile,
    #[error("IO error: {0}")]
    Io(io::Error),
}

#[derive(Debug)]
pub enum Event {
    Updated(usize),
}

#[derive(Debug)]
pub enum APIEvent {
    MapSegment(usize, usize),
    Event(Event),
    NextEvent(oneshot::Sender<Option<Event>>),
    Shutdown(oneshot::Sender<()>),
    Read(Range<usize>, oneshot::Sender<Result<Vec<String>, Error>>),
    FilePath(PathBuf),
}

#[derive(Clone, Debug)]
pub struct API {
    tx_api: UnboundedSender<APIEvent>,
}

impl API {
    pub fn new(tx_api: UnboundedSender<APIEvent>) -> Self {
        Self { tx_api }
    }

    pub async fn next(&self) -> Option<Event> {
        let (tx_response, rx_response): (
            oneshot::Sender<Option<Event>>,
            oneshot::Receiver<Option<Event>>,
        ) = oneshot::channel();
        if self.tx_api.send(APIEvent::NextEvent(tx_response)).is_err() {
            None
        } else {
            match rx_response.await {
                Ok(event) => event,
                Err(_) => None,
            }
        }
    }

    pub async fn shutdown(&self) -> Result<(), Error> {
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

pub struct Buffer {
    location: PathBuf,
    cancel: CancellationToken,
    tx_api: UnboundedSender<APIEvent>,
    rx_api: Option<UnboundedReceiver<APIEvent>>,
    tx_events: UnboundedSender<Event>,
    rx_events: Option<UnboundedReceiver<Event>>,
}

impl Buffer {
    pub fn new(location: PathBuf) -> Self {
        let (tx_api, rx_api): (UnboundedSender<APIEvent>, UnboundedReceiver<APIEvent>) =
            unbounded_channel();
        let (tx_events, rx_events): (UnboundedSender<Event>, UnboundedReceiver<Event>) =
            unbounded_channel();
        Self {
            location,
            cancel: CancellationToken::new(),
            tx_api,
            rx_api: Some(rx_api),
            tx_events,
            rx_events: Some(rx_events),
        }
    }

    pub fn get_api(&self) -> API {
        API {
            tx_api: self.tx_api.clone(),
        }
    }

    pub async fn attach<
        SO,
        PO,
        SE: error::Error,
        PE: error::Error,
        P: Parser<PO, PE>,
        A: source::API<SE>,
    >(
        &mut self,
        source_options: SO,
        parsers_options: PO,
        mut source: impl Source<SO, SE, A>,
        parser: P,
    ) -> Result<(), Error> {
        let rx_api = if let Some(rx_api) = self.rx_api.take() {
            rx_api
        } else {
            return Err(Error::AlreadyInUse);
        };
        let rx_events = if let Some(rx_events) = self.rx_events.take() {
            rx_events
        } else {
            return Err(Error::AlreadyInUse);
        };
        let source_api = source.get_api();
        let (source_res, res_decoding_task, res_api_task, res_events_task) = join!(
            async {
                let result = source
                    .open(source_options)
                    .await
                    .map_err(|e| Error::SourceError(e.to_string()));
                self.cancel.cancel();
                result
            },
            async {
                let result = self
                    .decoding_task(source_api, parsers_options, parser)
                    .await;
                self.cancel.cancel();
                result
            },
            async {
                let result = self.api_task(rx_api).await;
                self.cancel.cancel();
                result
            },
            async {
                let result = self.events_task(rx_events).await;
                self.cancel.cancel();
                result
            },
        );
        // TODO:
        // - shutdown source here
        if source_res.is_err() {
            source_res
        } else if res_decoding_task.is_err() {
            res_decoding_task
        } else if res_api_task.is_err() {
            res_api_task
        } else if res_events_task.is_err() {
            res_events_task
        } else {
            Ok(())
        }
    }

    async fn decoding_task<PO, SE: error::Error, PE: error::Error, P: Parser<PO, PE>>(
        &self,
        source_api: impl source::API<SE>,
        parsers_options: PO,
        parser: P,
    ) -> Result<(), Error> {
        // TODO:
        // - as soon as no Source implementation yet, should be clear:source
        //   would be available file data (like path) before "open" method would
        //   be called.
        let decoded_file_path = if parser.is_encoding_required() {
            let path = self.location.join(Uuid::new_v4().to_string());
            File::create(&path).await.map_err(Error::Io)?;
            path
        } else {
            source_api
                .get_source_file()
                .await
                .map_err(|e| Error::SourceError(e.to_string()))?
        };
        let mut decoded_file: Option<File> = if parser.is_encoding_required() {
            Some(File::open(&decoded_file_path).await.map_err(Error::Io)?)
        } else {
            None
        };
        let mut rest: Vec<u8> = vec![];
        self.tx_api
            .send(APIEvent::FilePath(decoded_file_path.clone()))
            .map_err(|e| Error::Channel(format!("fail to set decoded_file_path: {}", e)))?;
        while let Some(mut chunk) = select! {
            chunk = source_api.next() => chunk,
            _ = self.cancel.cancelled() => None
        } {
            rest.append(&mut chunk);
            let decoded = parser
                .decode(&rest, &parsers_options)
                .map_err(|e| Error::Parsing(e.to_string()))?;
            rest = decoded.rest;
            if decoded.output.is_empty() {
                continue;
            }
            let output_str = decoded.output.join("\n");
            let output_bytes = output_str.as_bytes();
            //println!(">>>>>>>>>>>>>>> {}", output_str);
            if let Some(decoded_file) = decoded_file.as_mut() {
                decoded_file
                    .write_all(output_bytes)
                    .await
                    .map_err(Error::Io)?;
            }
            self.tx_api
                .send(APIEvent::MapSegment(
                    output_bytes.len(),
                    decoded.output.len(),
                ))
                .map_err(|e| Error::Channel(e.to_string()))?;
        }
        if parser.is_encoding_required() {
            fs::remove_file(decoded_file_path).map_err(Error::Io)?;
        }
        Ok(())
    }

    async fn api_task(&self, mut rx_api: UnboundedReceiver<APIEvent>) -> Result<(), Error> {
        let mut map = Map::new();
        let mut rows_total: usize = 0;
        let mut bytes_total: usize = 0;
        let mut events: Vec<Event> = vec![];
        let mut pending_responser: Option<oneshot::Sender<Option<Event>>> = None;
        let mut decoded_file_path: Option<PathBuf> = None;
        while let Some(event) = select! {
            event = rx_api.recv() => event,
            _ = self.cancel.cancelled() => None,
        } {
            match event {
                APIEvent::MapSegment(bytes, rows) => {
                    bytes_total += bytes;
                    rows_total += rows;
                    map.push(bytes_total, rows_total);
                    if let Err(err) = self.tx_events.send(Event::Updated(rows_total)) {
                        return Err(Error::Channel(format!("Fail send event; error: {}", err)));
                    }
                }
                APIEvent::Event(event) => {
                    events.push(event);
                    if let Some(tx_response) = pending_responser.take() {
                        let event = events.remove(0);
                        if tx_response.send(Some(event)).is_err() {
                            return Err(Error::Channel(String::from(
                                "Fail to response for \"APIEvent::NextEvent\" from \"APIEvent::Event\"",
                            )));
                        }
                    }
                }
                APIEvent::NextEvent(tx_response) => {
                    if pending_responser.is_some() {
                        return Err(Error::MultipleEventRequest);
                    }
                    if events.is_empty() {
                        pending_responser = Some(tx_response);
                    } else {
                        let event = events.remove(0);
                        if tx_response.send(Some(event)).is_err() {
                            return Err(Error::Channel(String::from(
                                "Fail to response for \"APIEvent::NextEvent\"",
                            )));
                        }
                    }
                }
                APIEvent::FilePath(file_path) => {
                    decoded_file_path = Some(file_path);
                }
                APIEvent::Read(range, tx_response) => {
                    let file_path = if let Some(file_path) = decoded_file_path.as_ref() {
                        file_path
                    } else {
                        if tx_response.send(Err(Error::NoOutputFile)).is_err() {
                            return Err(Error::Channel(String::from(
                                "Fail to response for \"APIEvent::Read\"",
                            )));
                        }
                        continue;
                    };
                    if let Some((bytes, rows)) = map.get_bytes_range(&range) {
                        let mut file = File::open(&file_path).await.map_err(Error::Io)?;
                        file.seek(SeekFrom::Start(bytes.start as u64))
                            .await
                            .map_err(Error::Io)?;
                        let mut buffer = BytesMut::with_capacity(bytes.end - bytes.start);
                        file.read_buf(&mut buffer).await.map_err(Error::Io)?;
                        let mut lines: Vec<String> =
                            std::str::from_utf8(&buffer.freeze().slice(..))
                                .map_err(Error::UTF8String)?
                                .split('\n')
                                .collect::<Vec<&str>>()
                                .iter()
                                .map(|s| s.to_string())
                                .collect();
                        if rows.end - range.end > 0 {
                            lines.drain((rows.end - range.end)..);
                        }
                        if range.start - rows.start > 0 {
                            lines.drain(0..(range.start - rows.start));
                        }
                        if tx_response.send(Ok(lines)).is_err() {
                            return Err(Error::Channel(String::from(
                                "Fail to response for \"APIEvent::Read\"",
                            )));
                        }
                        // Let's rock here!
                    } else if tx_response.send(Err(Error::NoRange)).is_err() {
                        return Err(Error::Channel(String::from(
                            "Fail to response for \"APIEvent::Read\"",
                        )));
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
            }
        }
        Ok(())
    }

    async fn events_task(&self, mut rx_events: UnboundedReceiver<Event>) -> Result<(), Error> {
        while let Some(event) = select! {
            event = rx_events.recv() => event,
            _ = self.cancel.cancelled() => None,
        } {
            self.tx_api
                .send(APIEvent::Event(event))
                .map_err(|e| Error::Channel(e.to_string()))?;
        }
        Ok(())
    }
}
