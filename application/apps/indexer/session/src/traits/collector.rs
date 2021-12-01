use crate::traits::{
    buffer, buffer::Buffer, error, parser, parser::Parser, source, source::Source,
};
use std::{ops::Range, path::PathBuf};
use thiserror::Error as ThisError;
use tokio::{
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
    #[error("Buffer error: {0}")]
    Buffer(buffer::Error),
    #[error("Channel error: {0}")]
    Channel(String),
    #[error("Buffer event cannot be requested frop multiple points")]
    MultipleEventRequest,
    #[error("API already in use")]
    AlreadyInUse,
}

#[derive(Debug)]
pub enum Event {
    /// Stream length is updated
    /// (count_of_rows_in_stream)
    Update(usize),
}

#[derive(Debug)]
pub enum APIEvent {
    Event(Event),
    NextEvent(oneshot::Sender<Option<Event>>),
    Read(Range<usize>, oneshot::Sender<Result<Vec<String>, Error>>),
    Len(oneshot::Sender<usize>),
    Shutdown(oneshot::Sender<()>),
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

    pub async fn len(&self) -> Result<usize, Error> {
        let (tx_response, rx_response): (oneshot::Sender<usize>, oneshot::Receiver<usize>) =
            oneshot::channel();
        if self.tx_api.send(APIEvent::Len(tx_response)).is_err() {
            Err(Error::Channel(String::from(
                "Fail to send \"APIEvent::Len\"",
            )))
        } else {
            Ok(rx_response.await.map_err(|_| {
                Error::Channel(String::from("Fail to get response for \"APIEvent::Len\""))
            })?)
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

    /// Returns a number of rows to be delivered to render
    ///
    /// # Arguments
    ///
    /// * `range` - a coors of required rows
    async fn read<E: error::Error>(&self, range: Range<usize>) -> Result<Vec<String>, Error> {
        Ok(vec![])
    }
}

pub struct Collector {
    buffer: Option<Buffer>,
    buffer_api: buffer::API,
    tx_api: UnboundedSender<APIEvent>,
    rx_api: Option<UnboundedReceiver<APIEvent>>,
    cancel: CancellationToken,
}

impl Collector {
    pub fn new(location: PathBuf) -> Self {
        let buffer = Buffer::new(location);
        let buffer_api = buffer.get_api();
        let (tx_api, rx_api): (UnboundedSender<APIEvent>, UnboundedReceiver<APIEvent>) =
            unbounded_channel();
        Self {
            buffer: Some(buffer),
            buffer_api,
            tx_api,
            rx_api: Some(rx_api),
            cancel: CancellationToken::new(),
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
        P: parser::Parser<PO, PE>,
        A: source::API<SE>,
    >(
        &mut self,
        source_options: SO,
        parsers_options: PO,
        source: impl source::Source<SO, SE, A>,
        parser: P,
    ) -> Result<(), Error> {
        let rx_api = if let Some(rx_api) = self.rx_api.take() {
            rx_api
        } else {
            return Err(Error::AlreadyInUse);
        };
        let mut buffer = if let Some(buffer) = self.buffer.take() {
            buffer
        } else {
            return Err(Error::AlreadyInUse);
        };
        let ((buffer, buffer_res), buffer_listener_task_res, api_task) = join!(
            async {
                let result = buffer
                    .attach(source_options, parsers_options, source, parser)
                    .await;
                self.cancel.cancel();
                (buffer, result)
            },
            async {
                let result = self.buffer_listener_task().await;
                self.cancel.cancel();
                result
            },
            async {
                let result = self.api_task(rx_api).await;
                self.cancel.cancel();
                result
            },
        );
        let buffer_shutdown_res = self.buffer_api.shutdown().await;
        self.buffer = Some(buffer);
        if buffer_listener_task_res.is_err() {
            buffer_listener_task_res
        } else if api_task.is_err() {
            api_task
        } else if buffer_res.is_err() {
            buffer_res.map_err(Error::Buffer)
        } else if buffer_shutdown_res.is_err() {
            buffer_shutdown_res.map_err(Error::Buffer)
        } else {
            Ok(())
        }
    }

    async fn buffer_listener_task(&self) -> Result<(), Error> {
        while let Some(event) = select! {
            event = self.buffer_api.next() => event,
            _ = self.cancel.cancelled() => None
        } {
            match event {
                buffer::Event::Updated(rows) => {
                    self.tx_api
                        .send(APIEvent::Event(Event::Update(rows)))
                        .map_err(|e| Error::Channel(e.to_string()))?;
                }
            }
        }
        Ok(())
    }

    async fn api_task(&self, mut rx_api: UnboundedReceiver<APIEvent>) -> Result<(), Error> {
        let mut events: Vec<Event> = vec![];
        let mut pending_responser: Option<oneshot::Sender<Option<Event>>> = None;
        let mut len: usize = 0;
        while let Some(event) = select! {
            event = rx_api.recv() => event,
            _ = self.cancel.cancelled() => None,
        } {
            match event {
                APIEvent::Event(event) => {
                    if let Event::Update(rows) = event {
                        len = rows;
                    };
                    events.push(event);
                    if let Some(tx_response) = pending_responser.take() {
                        let event = events.remove(0);
                        if tx_response.send(Some(event)).is_err() {
                            return Err(Error::Channel(String::from(
                                "Fail to response for \"APIEvent::NextEvent\"",
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
                APIEvent::Read(range, tx_response) => {}
                APIEvent::Len(tx_response) => {
                    if tx_response.send(len).is_err() {
                        return Err(Error::Channel(String::from(
                            "Fail to response for \"APIEvent::Len\"",
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

    // /// Returns path to file with decoded data, which would be used for search
    // /// and grabbing
    // fn get_decoded_content_path() -> PathBuf;
}
