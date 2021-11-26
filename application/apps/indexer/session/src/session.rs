use crate::{
    events::{ComputationError, SyncChannel},
    operations,
    operations::Operation,
    state::{Api, SessionStateAPI},
};
use crossbeam_channel as cc;
use indexer_base::progress::Severity;
use log::{debug, info, warn};
use merging::concatenator::ConcatenatorInput;
use merging::merger::FileMergeOptions;
use processor::{
    dlt_source::DltSource,
    grabber::{AsyncGrabTrait, GrabMetadata, GrabTrait, GrabbedContent, LineRange},
    search::{SearchError, SearchFilter},
    text_source::TextFileSource,
};
use serde::Serialize;
use std::{
    fs::OpenOptions,
    path::{Path, PathBuf},
};
use tokio::sync::mpsc::{UnboundedReceiver, UnboundedSender};
use uuid::Uuid;

#[derive(Debug, Serialize, Clone)]
pub enum SupportedFileType {
    Text,
    Dlt,
}

pub fn get_supported_file_type(path: &Path) -> Option<SupportedFileType> {
    let extension = path.extension().map(|ext| ext.to_string_lossy());
    match extension {
        Some(ext) => match ext.to_lowercase().as_ref() {
            "dlt" => Some(SupportedFileType::Dlt),
            "txt" | "text" => Some(SupportedFileType::Text),
            _ => Some(SupportedFileType::Text),
        },
        None => Some(SupportedFileType::Text),
    }
}

pub fn lazy_init_grabber(
    input_p: &Path,
    source_id: &str,
) -> Result<(SupportedFileType, Box<dyn AsyncGrabTrait>), ComputationError> {
    match get_supported_file_type(input_p) {
        Some(SupportedFileType::Text) => {
            type GrabberType = processor::grabber::Grabber<TextFileSource>;
            let source = TextFileSource::new(input_p, source_id);
            let grabber = GrabberType::lazy(source).map_err(|e| {
                let err_msg = format!("Could not create grabber: {}", e);
                warn!("{}", err_msg);
                ComputationError::Process(err_msg)
            })?;
            Ok((SupportedFileType::Text, Box::new(grabber)))
        }
        Some(SupportedFileType::Dlt) => {
            type GrabberType = processor::grabber::Grabber<DltSource>;
            let source = DltSource::new(input_p, source_id);
            let grabber = GrabberType::lazy(source).map_err(|e| {
                ComputationError::Process(format!("Could not create grabber: {}", e))
            })?;
            Ok((SupportedFileType::Dlt, Box::new(grabber)))
        }
        None => {
            warn!("Trying to assign unsupported file type: {:?}", input_p);
            Err(ComputationError::OperationNotSupported(
                "Unsupported file type".to_string(),
            ))
        }
    }
}

pub type OperationsChannel = (
    UnboundedSender<(Uuid, Operation)>,
    UnboundedReceiver<(Uuid, Operation)>,
);

#[derive(Debug)]
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
                type GrabberType = processor::grabber::Grabber<TextFileSource>;
                let source = TextFileSource::new(&file_path, "search_results");
                let mut grabber = match GrabberType::new(source) {
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

    pub async fn get_stream_len(&mut self) -> Result<i64, ComputationError> {
        if !self.is_opened() {
            return Err(ComputationError::SessionUnavailable);
        }
        match &self.get_updated_content_grabber().await?.get_metadata() {
            Some(md) => Ok(md.line_count as i64),
            None => Err(ComputationError::Protocol("Cannot happen".to_owned())),
        }
    }

    pub async fn get_search_len(&mut self) -> Result<i64, ComputationError> {
        if !self.is_opened() {
            return Err(ComputationError::SessionUnavailable);
        }
        let grabber = if let Some(grabber) = self.get_search_grabber()? {
            grabber
        } else {
            return Ok(0);
        };
        match grabber.get_metadata() {
            Some(md) => Ok(md.line_count as i64),
            None => Ok(0),
        }
    }

    pub async fn grab(
        &mut self,
        start_line_index: i64,
        number_of_lines: i64,
    ) -> Result<String, ComputationError> {
        if !self.is_opened() {
            return Err(ComputationError::SessionUnavailable);
        }
        info!("grab from {} ({} lines)", start_line_index, number_of_lines);
        let grabbed_content = self
            .get_updated_content_grabber()
            .await?
            .grab_content(&LineRange::from(
                (start_line_index as u64)..=((start_line_index + number_of_lines - 1) as u64),
            ))
            .map_err(|e| ComputationError::Communication(format!("grab content failed: {}", e)))?;
        let serialized =
            serde_json::to_string(&grabbed_content).map_err(|_| ComputationError::InvalidData)?;
        Ok(serialized)
    }

    pub fn stop(&mut self, operation_id: String) -> Result<(), ComputationError> {
        if !self.is_opened() {
            return Err(ComputationError::SessionUnavailable);
        }
        let _ = self.tx_operations.send((
            operations::uuid_from_str(&operation_id)?,
            operations::Operation::End,
        ));
        self.running = false;
        Ok(())
    }

    pub async fn assign(
        &mut self,
        file_path: String,
        source_id: String,
        operation_id: String,
    ) -> Result<(), ComputationError> {
        if !self.is_opened() {
            return Err(ComputationError::SessionUnavailable);
        }
        debug!("send assign event on channel");
        let input_p = PathBuf::from(&file_path);
        let (source_type, boxed_grabber) = lazy_init_grabber(&input_p, &source_id)?;
        self.content_grabber = Some(boxed_grabber);
        match self.tx_operations.send((
            operations::uuid_from_str(&operation_id)?,
            operations::Operation::Assign {
                file_path: input_p,
                source_id,
                source_type,
            },
        )) {
            Ok(_) => Ok(()),
            Err(e) => Err(ComputationError::Process(format!(
                "Could not send operation on channel. Error: {}",
                e
            ))),
        }
    }

    pub async fn grab_search(
        &mut self,
        start_line_index: i64,
        number_of_lines: i64,
    ) -> Result<String, ComputationError> {
        if !self.is_opened() {
            return Err(ComputationError::SessionUnavailable);
        }
        info!(
            "grab search results from {} ({} lines)",
            start_line_index, number_of_lines
        );
        let grabber = if let Some(grabber) = self.get_search_grabber()? {
            grabber
        } else {
            let serialized = serde_json::to_string(&GrabbedContent {
                grabbed_elements: vec![],
            })
            .map_err(|_| ComputationError::InvalidData)?;
            return Ok(serialized);
        };
        let grabbed_content: GrabbedContent = grabber
            .grab_content(&LineRange::from(
                (start_line_index as u64)..=((start_line_index + number_of_lines) as u64),
            ))
            .map_err(|e| {
                warn!("Grab search content failed: {}", e);
                ComputationError::SearchError(SearchError::Grab(e))
            })?;
        let mut results: GrabbedContent = GrabbedContent {
            grabbed_elements: vec![],
        };
        let mut ranges = vec![];
        let mut from_pos: u64 = 0;
        let mut to_pos: u64 = 0;
        for (i, el) in grabbed_content.grabbed_elements.iter().enumerate() {
            match el.content.parse::<u64>() {
                Ok(pos) => {
                    if i == 0 {
                        from_pos = pos;
                    } else if to_pos + 1 != pos {
                        ranges.push(std::ops::RangeInclusive::new(from_pos, to_pos));
                        from_pos = pos;
                    }
                    to_pos = pos;
                }
                Err(e) => {
                    return Err(ComputationError::Process(format!("{}", e)));
                }
            }
        }
        if (!ranges.is_empty() && ranges[ranges.len() - 1].start() != &from_pos)
            || (ranges.is_empty() && !grabbed_content.grabbed_elements.is_empty())
        {
            ranges.push(std::ops::RangeInclusive::new(from_pos, to_pos));
        }
        let mut row: usize = start_line_index as usize;
        for range in ranges.iter() {
            let mut original_content = self
                .get_updated_content_grabber()
                .await?
                .grab_content(&LineRange::from(range.clone()))
                .map_err(|e| {
                    ComputationError::Communication(format!("grab matched content failed: {}", e))
                })?;
            let start = *range.start() as usize;
            for (j, element) in original_content.grabbed_elements.iter_mut().enumerate() {
                element.pos = Some(start + j);
                element.row = Some(row);
                row += 1;
            }
            results
                .grabbed_elements
                .append(&mut original_content.grabbed_elements);
        }
        debug!(
            "grabbing search result from original content {} rows",
            results.grabbed_elements.len()
        );
        let serialized =
            serde_json::to_string(&results).map_err(|_| ComputationError::InvalidData)?;
        Ok(serialized)
    }

    pub async fn apply_search_filters(
        &mut self,
        filters: Vec<SearchFilter>,
        operation_id: String,
    ) -> Result<(), ComputationError> {
        if !self.is_opened() {
            return Err(ComputationError::SessionUnavailable);
        }
        self.search_grabber = None;
        let (tx_response, rx_response): (cc::Sender<()>, cc::Receiver<()>) = cc::bounded(1);
        self.tx_operations
            .send((
                Uuid::new_v4(),
                operations::Operation::DropSearch(tx_response),
            ))
            .map_err(|e| ComputationError::Process(e.to_string()))?;
        if let Err(err) = rx_response.recv() {
            return Err(ComputationError::Process(format!(
                "Cannot drop search map. Error: {}",
                err
            )));
        }
        let target_file = if let Some(content) = self.content_grabber.as_ref() {
            content.as_ref().associated_file()
        } else {
            warn!("Cannot search when no file has been assigned");
            return Err(ComputationError::NoAssignedContent);
        };
        info!(
            "Search (operation: {}) will be done in {:?} withing next filters: {:?}",
            operation_id, target_file, filters
        );
        match self.tx_operations.send((
            operations::uuid_from_str(&operation_id)?,
            operations::Operation::Search {
                target_file,
                filters,
            },
        )) {
            Ok(_) => Ok(()),
            Err(e) => Err(ComputationError::Process(format!(
                "Could not send operation on channel. Error: {}",
                e
            ))),
        }
    }

    pub async fn extract_matches(
        &mut self,
        filters: Vec<SearchFilter>,
        operation_id: String,
    ) -> Result<(), ComputationError> {
        if !self.is_opened() {
            return Err(ComputationError::SessionUnavailable);
        }
        let target_file = if let Some(content) = self.content_grabber.as_ref() {
            content.as_ref().associated_file()
        } else {
            return Err(ComputationError::NoAssignedContent);
        };
        info!(
            "Extract (operation: {}) will be done in {:?} withing next filters: {:?}",
            operation_id, target_file, filters
        );
        match self
            .tx_operations
            .send((
                operations::uuid_from_str(&operation_id)?,
                operations::Operation::Extract {
                    target_file,
                    filters,
                },
            ))
            .map_err(|_| {
                ComputationError::Process("Could not send operation on channel".to_string())
            }) {
            Ok(_) => Ok(()),
            Err(e) => Err(ComputationError::Process(format!(
                "Could not send operation on channel. Error: {}",
                e
            ))),
        }
    }

    pub async fn get_map(
        &mut self,
        operation_id: String,
        dataset_len: i32,
        from: Option<i64>,
        to: Option<i64>,
    ) -> Result<String, ComputationError> {
        if !self.is_opened() {
            return Err(ComputationError::SessionUnavailable);
        }
        let mut range: Option<(u64, u64)> = None;
        if let Some(from) = from {
            if let Some(to) = to {
                if from >= 0 && to >= 0 {
                    if from <= to {
                        range = Some((from as u64, to as u64));
                    } else {
                        warn!(
                            "Invalid range (operation: {}): from = {}; to = {}",
                            operation_id, from, to
                        );
                    }
                }
            }
        }
        info!(
            "Map requested (operation: {}). Range: {:?}",
            operation_id, range
        );
        if let Err(e) = self
            .tx_operations
            .send((
                operations::uuid_from_str(&operation_id)?,
                operations::Operation::Map {
                    dataset_len: dataset_len as u16,
                    range,
                },
            ))
            .map_err(|_| {
                ComputationError::Process("Could not send operation on channel".to_string())
            })
        {
            return Err(e);
        }
        Ok(operation_id)
    }

    pub async fn get_nearest_to(
        &mut self,
        operation_id: String,
        position_in_stream: i64,
    ) -> Result<(), ComputationError> {
        if !self.is_opened() {
            return Err(ComputationError::SessionUnavailable);
        }
        self.tx_operations
            .send((
                operations::uuid_from_str(&operation_id)?,
                operations::Operation::GetNearestPosition(position_in_stream as u64),
            ))
            .map_err(|e| ComputationError::Process(e.to_string()))?;
        Ok(())
    }

    pub async fn concat(
        &mut self,
        files: Vec<ConcatenatorInput>,
        append: bool,
        operation_id: String,
    ) -> Result<(), ComputationError> {
        if !self.is_opened() {
            return Err(ComputationError::SessionUnavailable);
        }
        //TODO: out_path should be gererics by some settings.
        let (out_path, out_path_str) = if files.is_empty() {
            return Err(ComputationError::InvalidData);
        } else {
            let filename = PathBuf::from(&files[0].path);
            if let Some(parent) = filename.parent() {
                if let Some(file_name) = filename.file_name() {
                    let path = parent.join(format!("{}.concat", file_name.to_string_lossy()));
                    (path.clone(), path.to_string_lossy().to_string())
                } else {
                    return Err(ComputationError::InvalidData);
                }
            } else {
                return Err(ComputationError::InvalidData);
            }
        };
        let _ = OpenOptions::new()
            .read(true)
            .write(true)
            .create(true)
            .open(&out_path)
            .map_err(|_| {
                ComputationError::IoOperation(format!(
                    "Could not create/open file {}",
                    &out_path_str
                ))
            })?;
        let (source_type, boxed_grabber) = lazy_init_grabber(&out_path, &out_path_str)?;
        self.content_grabber = Some(boxed_grabber);
        match self.tx_operations.send((
            operations::uuid_from_str(&operation_id)?,
            operations::Operation::Concat {
                files,
                out_path,
                append,
                source_type,
                source_id: out_path_str,
            },
        )) {
            Ok(_) => Ok(()),
            Err(e) => Err(ComputationError::Process(format!(
                "Could not send operation on channel. Error: {}",
                e
            ))),
        }
    }

    pub async fn merge(
        &mut self,
        files: Vec<FileMergeOptions>,
        append: bool,
        operation_id: String,
    ) -> Result<(), ComputationError> {
        if !self.is_opened() {
            return Err(ComputationError::SessionUnavailable);
        }
        //TODO: out_path should be gererics by some settings.
        let (out_path, out_path_str) = if files.is_empty() {
            return Err(ComputationError::InvalidData);
        } else {
            let filename = PathBuf::from(&files[0].path);
            if let Some(parent) = filename.parent() {
                if let Some(file_name) = filename.file_name() {
                    let path = parent.join(format!("{}.merged", file_name.to_string_lossy()));
                    (path.clone(), path.to_string_lossy().to_string())
                } else {
                    return Err(ComputationError::InvalidData);
                }
            } else {
                return Err(ComputationError::InvalidData);
            }
        };
        let _ = OpenOptions::new()
            .read(true)
            .write(true)
            .create(true)
            .open(&out_path)
            .map_err(|_| {
                ComputationError::IoOperation(format!(
                    "Could not create/open file {}",
                    &out_path_str
                ))
            })?;
        let (source_type, boxed_grabber) = lazy_init_grabber(&out_path, &out_path_str)?;
        self.content_grabber = Some(boxed_grabber);
        match self.tx_operations.send((
            operations::uuid_from_str(&operation_id)?,
            operations::Operation::Merge {
                files,
                out_path,
                append,
                source_type,
                source_id: out_path_str,
            },
        )) {
            Ok(_) => Ok(()),
            Err(e) => Err(ComputationError::Process(format!(
                "Could not send operation on channel. Error: {}",
                e
            ))),
        }
    }

    pub async fn set_debug(&mut self, debug: bool) -> Result<(), ComputationError> {
        if let Some(state) = self.state_api.as_ref() {
            state
                .set_debug(debug)
                .await
                .map_err(ComputationError::NativeError)
        } else {
            Err(ComputationError::SessionUnavailable)
        }
    }

    pub async fn get_operations_stat(&mut self) -> Result<String, ComputationError> {
        if !self.is_opened() {
            return Err(ComputationError::SessionUnavailable);
        }
        if let Some(state) = self.state_api.as_ref() {
            state
                .get_operations_stat()
                .await
                .map_err(ComputationError::NativeError)
        } else {
            Err(ComputationError::SessionUnavailable)
        }
    }

    pub async fn sleep(&mut self, operation_id: String, ms: i64) -> Result<(), ComputationError> {
        if !self.is_opened() {
            return Err(ComputationError::SessionUnavailable);
        }
        match self.tx_operations.send((
            operations::uuid_from_str(&operation_id)?,
            operations::Operation::Sleep(ms as u64),
        )) {
            Ok(_) => Ok(()),
            Err(e) => Err(ComputationError::Process(format!(
                "Could not send operation on channel. Error: {}",
                e
            ))),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct GeneralError {
    severity: Severity,
    message: String,
}
