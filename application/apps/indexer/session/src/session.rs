use crate::{
    events::{CallbackEvent, ComputationError, NativeError, NativeErrorKind, SyncChannel},
    operations::{Operation, OperationAPI},
    state::{Api, SessionStateAPI},
    tail, writer,
};
use indexer_base::progress::{ComputationResult, Progress, Severity};
use log::{debug, warn};
use processor::{
    grabber::{AsyncGrabTrait, GrabMetadata, GrabTrait, MetadataSource},
    text_source::TextFileSource,
};
use serde::Serialize;
use sources::{producer::MessageProducer, ByteSource, LogMessage, MessageStreamItem, Parser};
use std::{fs::File, io::prelude::*, path::PathBuf};
use tokio::{
    join, select,
    sync::mpsc::{unbounded_channel, UnboundedReceiver, UnboundedSender},
};
use tokio_util::sync::CancellationToken;
use uuid::Uuid;

pub type OperationsChannel = (
    UnboundedSender<(Uuid, Operation)>,
    UnboundedReceiver<(Uuid, Operation)>,
);

type Grabber = processor::grabber::Grabber<TextFileSource>;

pub enum Target<T, P, S>
where
    T: LogMessage,
    P: Parser<T>,
    S: ByteSource,
{
    TextFile(PathBuf),
    Producer(MessageProducer<T, P, S>),
}

pub struct Session {
    pub id: String,
    pub running: bool,
    pub content_grabber: Option<Box<dyn AsyncGrabTrait>>,
    pub search_grabber: Option<Box<dyn AsyncGrabTrait>>,
    pub tx_operations: UnboundedSender<(Uuid, Operation)>,
    pub rx_operations: Option<UnboundedReceiver<(Uuid, Operation)>>,
    pub rx_state_api: Option<UnboundedReceiver<Api>>,
    pub state_api: Option<SessionStateAPI>,
    // channel to store the metadata of the search results once available
    pub search_metadata_channel: SyncChannel<Option<(PathBuf, GrabMetadata)>>,
}

impl Session {
    /// actually name of method should be "assign" and it doesn't metter what we have behind (stream, binary file
    /// or text file)
    /// a loop inside should be stopped only in:
    /// - error case
    /// - shutdown case
    pub async fn stream<T: LogMessage, P: Parser<T>, S: ByteSource>(
        &self,
        target: Target<T, P, S>,
        dest_path: Option<PathBuf>,
        operation_api: &OperationAPI,
        state: &SessionStateAPI,
    ) -> Result<(), ComputationError> {
        match target {
            Target::TextFile(path) => {
                let (tx_update, mut rx_update): (UnboundedSender<()>, UnboundedReceiver<()>) =
                    unbounded_channel();
                let mut session_grabber =
                    match Grabber::new(TextFileSource::new(&path, &path.to_string_lossy())) {
                        Ok(grabber) => grabber,
                        Err(err) => {
                            let msg = format!("Failed to create search grabber. Error: {}", err);
                            warn!("{}", msg);
                            return Err(ComputationError::Protocol(msg));
                        }
                    };
                let tracker =
                    tail::Tracker::new(path, tx_update, operation_api.get_cancellation_token());
                self.update(&mut session_grabber, operation_api, state)?;
                while rx_update.recv().await.is_some() {
                    self.update(&mut session_grabber, operation_api, state)?;
                }
                Ok(())
            }
            Target::Producer(mut producer) => {
                let dest_path = if let Some(dest_path) = dest_path {
                    dest_path
                } else {
                    return Err(ComputationError::DestinationPath);
                };
                let file_name = Uuid::new_v4();
                let session_file_path = dest_path.join(format!("{}.session", file_name));
                let binary_file_path = dest_path.join(format!("{}.bin", file_name));
                let (tx_session_file_flush, mut rx_session_file_flush): (
                    UnboundedSender<usize>,
                    UnboundedReceiver<usize>,
                ) = unbounded_channel();
                let (tx_binary_file_flush, mut rx_binary_file_flush): (
                    UnboundedSender<usize>,
                    UnboundedReceiver<usize>,
                ) = unbounded_channel();
                let session_writer = writer::session::Writer::new(
                    &session_file_path,
                    tx_session_file_flush,
                    operation_api.get_cancellation_token(),
                )
                .await
                .map_err(|e| ComputationError::IoOperation(e.to_string()))?;
                let binary_writer = writer::binary::Writer::new(
                    &binary_file_path,
                    tx_binary_file_flush,
                    operation_api.get_cancellation_token(),
                )
                .await
                .map_err(|e| ComputationError::IoOperation(e.to_string()))?;
                // TODO: producer should return relevate source_id. It should be used
                // instead an internal file alias (file_name.to_string())
                //
                // call should looks like:
                // TextFileSource::new(&session_file_path, producer.source_alias());
                // or
                // TextFileSource::new(&session_file_path, producer.source_id());
                let mut session_grabber = match Grabber::new(TextFileSource::new(
                    &session_file_path,
                    &file_name.to_string(),
                )) {
                    Ok(grabber) => grabber,
                    Err(err) => {
                        let msg = format!("Failed to create search grabber. Error: {}", err);
                        warn!("{}", msg);
                        return Err(ComputationError::Protocol(msg));
                    }
                };
                let (session_writer, binary_writer, producer) = join!(
                    async {
                        while let Some(_bytes) = rx_session_file_flush.recv().await {
                            self.update(&mut session_grabber, operation_api, state)?;
                        }
                        Ok::<(), ComputationError>(())
                    },
                    async {
                        while let Some(_bytes) = rx_binary_file_flush.recv().await {}
                        Ok::<(), ComputationError>(())
                    },
                    async {
                        for item in producer.by_ref() {
                            if let (_, item) = item {
                                match item {
                                    MessageStreamItem::Item(item) => {
                                        // TODO: Try to get rid of channels
                                        session_writer
                                            .send(format!("{}\n", item).as_bytes())
                                            .map_err(|e| {
                                                ComputationError::IoOperation(e.to_string())
                                            })?;
                                        binary_writer.send(item.as_stored_bytes()).map_err(
                                            |e| ComputationError::IoOperation(e.to_string()),
                                        )?;
                                    }
                                    MessageStreamItem::Done => {
                                        break;
                                    }
                                    _ => {}
                                }
                            }
                        }
                        Ok::<(), ComputationError>(())
                    }
                );
                if let Err(err) = session_writer {
                    Err(err)
                } else if let Err(err) = binary_writer {
                    Err(err)
                } else if let Err(err) = producer {
                    Err(err)
                } else {
                    Ok(())
                }
            }
        }
    }

    fn update(
        &self,
        grabber: &mut Grabber,
        operation_api: &OperationAPI,
        state: &SessionStateAPI,
    ) -> Result<(), ComputationError> {
        let metadata = grabber.source().from_file(Some(state.get_shutdown_token()));
        match metadata {
            Ok(ComputationResult::Item(metadata)) => {
                debug!("RUST: received new stream metadata");
                let line_count = metadata.line_count as u64;
                operation_api.emit(CallbackEvent::StreamUpdated(line_count));
                if let Err(err) = grabber.merge_metadata(metadata) {
                    let msg = format!(
                        "Failed to inject metadata into session grabber. Error: {}",
                        err
                    );
                    warn!("{}", msg);
                    return Err(ComputationError::Protocol(msg));
                }
            }
            Ok(ComputationResult::Stopped) => {
                debug!("RUST: stream metadata calculation aborted");
                operation_api.emit(CallbackEvent::Progress {
                    uuid: operation_api.id(),
                    progress: Progress::Stopped,
                });
            }
            Err(e) => {
                let err_msg = format!("RUST error computing session metadata: {:?}", e);
                operation_api.emit(CallbackEvent::SessionError(NativeError {
                    severity: Severity::WARNING,
                    kind: NativeErrorKind::ComputationFailed,
                    message: Some(err_msg),
                }));
            }
        }
        Ok(())
    }

    /// will result in a grabber that has it's metadata generated
    /// this function will first check if there has been some new metadata that was previously
    /// written to the metadata-channel. If so, this metadata is used in the grabber.
    /// If there was no new metadata, we make sure that the metadata has been set.
    /// If no metadata is available, an error is returned. That means that assign was not completed before.
    pub async fn get_updated_content_grabber(
        &mut self,
    ) -> Result<&mut Box<dyn AsyncGrabTrait>, ComputationError> {
        let current_grabber = match &mut self.content_grabber {
            Some(c) => Ok(c),
            None => {
                let msg = "Need a grabber first to work with metadata".to_owned();
                warn!("{}", msg);
                Err(ComputationError::Protocol(msg))
            }
        }?;
        if let Some(state) = self.state_api.as_ref() {
            let metadata = state
                .extract_metadata()
                .await
                .map_err(ComputationError::NativeError)?;
            if let Some(metadata) = metadata {
                current_grabber
                    .inject_metadata(metadata)
                    .map_err(|e| ComputationError::Process(format!("{:?}", e)))?;
            }
            Ok(current_grabber)
        } else {
            Err(ComputationError::SessionUnavailable)
        }
    }

    pub fn get_search_grabber(
        &mut self,
    ) -> Result<Option<&mut Box<dyn AsyncGrabTrait>>, ComputationError> {
        if self.search_grabber.is_none() && !self.search_metadata_channel.1.is_empty() {
            // We are intrested only in last message in queue, all others messages can be just dropped.
            let latest = self.search_metadata_channel.1.try_iter().last().flatten();
            if let Some((file_path, metadata)) = latest {
                let source = TextFileSource::new(&file_path, "search_results");
                let mut grabber = match Grabber::new(source) {
                    Ok(grabber) => grabber,
                    Err(err) => {
                        let msg = format!("Failed to create search grabber. Error: {}", err);
                        warn!("{}", msg);
                        return Err(ComputationError::Protocol(msg));
                    }
                };
                if let Err(err) = grabber.inject_metadata(metadata) {
                    let msg = format!(
                        "Failed to inject metadata into search grabber. Error: {}",
                        err
                    );
                    warn!("{}", msg);
                    return Err(ComputationError::Protocol(msg));
                }
                self.search_grabber = Some(Box::new(grabber));
            } else {
                self.search_grabber = None;
            }
        }
        let grabber = match &mut self.search_grabber {
            Some(c) => c,
            None => return Ok(None),
        };
        match grabber.get_metadata() {
            Some(_) => {
                debug!("reusing cached metadata");
                Ok(Some(grabber))
            }
            None => {
                let msg = "No metadata available for search grabber".to_owned();
                warn!("{}", msg);
                Err(ComputationError::Protocol(msg))
            }
        }
    }

    pub fn is_opened(&self) -> bool {
        if self.rx_state_api.is_some() {
            false
        } else if let Some(state_api) = self.state_api.as_ref() {
            !state_api.is_shutdown()
        } else {
            false
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct GeneralError {
    severity: Severity,
    message: String,
}
