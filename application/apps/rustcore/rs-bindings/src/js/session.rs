use crate::js::events::SyncChannel;
use crate::js::events::{AsyncBroadcastChannel, AsyncChannel};
use crate::js::events::{CallbackEvent, ComputationError, OperationDone};
use crate::js::events::{NativeError, NativeErrorKind};
use crossbeam_channel as cc;
use indexer_base::progress::ComputationResult::Item;
use indexer_base::progress::Severity;
use node_bindgen::{
    core::{val::JsEnv, NjError, TryIntoJs},
    derive::node_bindgen,
    sys::napi_value,
};
use processor::dlt_source::DltSource;
use processor::grabber::GrabTrait;
use processor::grabber::LineRange;
use processor::grabber::MetadataSource;
use processor::grabber::{GrabMetadata, Grabber};
use processor::search::SearchFilter;
use processor::text_source::TextFileSource;
use serde::Serialize;
use std::path::Path;
use std::path::PathBuf;
use std::thread;
use tokio::runtime::Runtime;
use tokio::sync::{broadcast, mpsc};
use uuid::Uuid;

pub struct SessionState {
    pub assigned_file: Option<String>,
    pub filters: Vec<SearchFilter>,
}

#[derive(Debug, Serialize, Clone)]
enum Operation {
    Assign {
        file_path: String,
        source_id: String,
        operation_id: Uuid,
        source_type: SupportedFileType,
    },
    End,
}

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

pub struct RustSession {
    pub id: String,
    pub running: bool,
    pub content_grabber: Option<Box<dyn GrabTrait>>,
    pub search_grabber: Option<Box<dyn GrabTrait>>,
    // pub state: Arc<Mutex<SessionState>>,
    callback: Option<Box<dyn Fn(CallbackEvent) + Send + 'static>>,

    op_channel: AsyncBroadcastChannel<Operation>,
    // channel that allows to propagate shutdown requests to ongoing operations
    shutdown_channel: AsyncBroadcastChannel<()>,
    // channel to store the metadata of a file once available
    metadata_channel: SyncChannel<Result<Option<GrabMetadata>, ComputationError>>,
    // channel to store the metadata of the search results once available
    search_metadata_channel: AsyncChannel<Result<Option<GrabMetadata>, ComputationError>>,
}

impl RustSession {
    /// will result in a grabber that has it's metadata generated
    /// this function will first check if there has been some new metadata that was previously
    /// written to the metadata-channel. If so, this metadata is used in the grabber.
    /// If there was no new metadata, we make sure that the metadata has been set.
    /// If no metadata is available, an error is returned. That means that assign was not completed before.
    fn get_loaded_grabber(&mut self) -> Result<&mut Box<dyn GrabTrait>, ComputationError> {
        let current_grabber = match &mut self.content_grabber {
            Some(c) => Ok(c),
            None => Err(ComputationError::Protocol(
                "Need a grabber first to work with metadata".to_owned(),
            )),
        }?;
        let fresh_metadata_result = match self.metadata_channel.1.try_recv() {
            Ok(new_metadata) => {
                println!("RUST: new metadata arrived: {:?} lines", new_metadata);
                Ok(Some(new_metadata))
            }
            Err(cc::TryRecvError::Empty) => {
                println!("RUST: no new metadata arrived");
                Ok(None)
            }
            Err(cc::TryRecvError::Disconnected) => Err(ComputationError::Protocol(
                "Metadata channel was disconnected".to_owned(),
            )),
        };
        let grabber = match fresh_metadata_result {
            Ok(Some(res)) => {
                println!("RUST: Trying to use new results");
                match res {
                    Ok(Some(metadata)) => {
                        println!("RUST: setting new metadata into content_grabber");
                        current_grabber
                            .inject_metadata(metadata)
                            .map_err(|e| ComputationError::Process(format!("{:?}", e)))?;
                        Ok(current_grabber)
                    }
                    Ok(None) => Err(ComputationError::Process(
                        "No metadata available".to_owned(),
                    )),
                    Err(e) => Err(ComputationError::Protocol(format!(
                        "Problems during metadata generation: {}",
                        e
                    ))),
                }
            }
            Ok(None) => match current_grabber.get_metadata() {
                Some(_) => {
                    println!("RUST: reusing cached metadata");
                    Ok(current_grabber)
                }
                None => Err(ComputationError::Protocol(
                    "No metadata available for grabber".to_owned(),
                )),
            },
            Err(e) => Err(e),
        }?;
        Ok(grabber)
    }
}

enum GrabberKind {
    Content,
    Search,
}

async fn compute() -> Uuid {
    thread::sleep(std::time::Duration::from_millis(1000));
    Uuid::new_v4()
}

#[node_bindgen]
impl RustSession {
    #[node_bindgen(constructor)]
    pub fn new(id: String) -> Self {
        // init_logging();
        Self {
            id,
            running: false,
            // state: Arc::new(Mutex::new(SessionState {
            //     assigned_file: None,
            //     filters: vec![],
            // })),
            content_grabber: None,
            callback: None,
            search_grabber: None,
            shutdown_channel: broadcast::channel(1),
            op_channel: broadcast::channel(10),
            metadata_channel: cc::bounded(1),
            search_metadata_channel: mpsc::channel(1),
        }
    }

    #[node_bindgen(getter)]
    fn id(&self) -> String {
        println!("value");
        self.id.clone()
    }

    #[node_bindgen]
    fn cancel_operations(&mut self) -> Result<(), ComputationError> {
        let _ = self.shutdown_channel.0.send(());
        Ok(())
    }

    /// this will start of the event loop that processes different rust operations
    /// in the event-loop-thread
    /// the callback is used to report back to javascript
    #[node_bindgen(mt)]
    fn start<F: Fn(CallbackEvent) + Send + 'static>(
        &mut self,
        callback: F,
    ) -> Result<(), ComputationError> {
        // self.callback = Some(Box::new(callback));
        let rt = Runtime::new().map_err(|e| {
            ComputationError::Process(format!("Could not start tokio runtime: {}", e))
        })?;
        let mut event_stream = self.op_channel.0.subscribe();
        self.running = true;
        let shutdown_tx = self.shutdown_channel.0.clone();
        let metadata_tx = self.metadata_channel.0.clone();
        thread::spawn(move || {
            rt.block_on(async {
                println!("RUST: running runtime");
                loop {
                    match event_stream.recv().await {
                        Ok(op_event) => match op_event {
                            Operation::Assign {
                                file_path,
                                source_id,
                                operation_id,
                                source_type,
                            } => {
                                println!("RUST: received Assign operation event");
                                let file_path = Path::new(&file_path);
                                let metadata_res = match source_type {
                                    SupportedFileType::Dlt => {
                                        let source = DltSource::new(file_path, &source_id);
                                        Some(source.from_file(None))
                                    }
                                    SupportedFileType::Text => {
                                        let source = TextFileSource::new(file_path, &source_id);
                                        Some(source.from_file(None))
                                    }
                                };
                                match metadata_res {
                                    Some(Ok(Item(metadata))) => {
                                        println!("RUST: received metadata");
                                        let line_count: u64 = metadata.line_count as u64;
                                        let _ = metadata_tx.send(Ok(Some(metadata)));
                                        callback(CallbackEvent::StreamUpdated(line_count));
                                    }
                                    Some(Ok(_)) => {
                                        println!("RUST: metadata calculation aborted");
                                        let _ = metadata_tx.send(Ok(None));
                                    }
                                    Some(Err(e)) => {
                                        println!("RUST error computing metadata");
                                        let _ = metadata_tx.send(Err(ComputationError::Process(
                                            format!("Could not compute metadata: {}", e),
                                        )));
                                        callback(CallbackEvent::OperationError((
                                            operation_id,
                                            NativeError {
                                                severity: Severity::WARNING,
                                                kind: NativeErrorKind::ComputationFailed,
                                            },
                                        )));
                                    }
                                    None => callback(CallbackEvent::OperationError((
                                        operation_id,
                                        NativeError {
                                            severity: Severity::WARNING,
                                            kind: NativeErrorKind::UnsupportedFileType,
                                        },
                                    ))),
                                }
                                callback(CallbackEvent::OperationDone(OperationDone {
                                    uuid: operation_id,
                                    result: None,
                                }));
                            }
                            Operation::End => {
                                println!("RUST: received End operation event");
                                callback(CallbackEvent::SessionDestroyed);
                                break;
                            }
                        },
                        Err(e) => {
                            println!("Rust: error on channel: {}", e);
                            break;
                        }
                    }
                }
                println!("RUST: exiting runtime");
            })
        });
        Ok(())
    }

    #[node_bindgen]
    fn get_stream_len(&mut self) -> Result<i64, ComputationError> {
        match &self.get_loaded_grabber()?.get_metadata() {
            Some(md) => Ok(md.line_count as i64),
            None => Err(ComputationError::Protocol("Cannot happen".to_owned())),
        }
    }

    #[node_bindgen]
    fn grab(
        &mut self,
        start_line_index: i64,
        number_of_lines: i64,
    ) -> Result<String, ComputationError> {
        println!(
            "RUST: grab from {} ({} lines)",
            start_line_index, number_of_lines
        );
        let grabbed_content = self
            .get_loaded_grabber()?
            .grab_content(&LineRange::from(
                (start_line_index as u64)..=((start_line_index + number_of_lines - 1) as u64),
            ))
            .map_err(|e| ComputationError::Communication(format!("{}", e)))?;
        let serialized =
            serde_json::to_string(&grabbed_content).map_err(|_| ComputationError::InvalidData)?;

        Ok(serialized)
    }

    #[node_bindgen]
    fn stop(&mut self) -> Result<(), ComputationError> {
        let _ = self.op_channel.0.send(Operation::End);
        self.running = false;
        Ok(())
    }

    #[node_bindgen]
    fn assign(&mut self, file_path: String, source_id: String) -> Result<String, ComputationError> {
        println!("RUST: send assign event on channel");
        let operation_id = Uuid::new_v4();
        let input_p = PathBuf::from(&file_path);
        let source_type = match get_supported_file_type(&input_p) {
            Some(SupportedFileType::Text) => {
                type GrabberType = processor::grabber::Grabber<TextFileSource>;
                let source = TextFileSource::new(&input_p, &source_id);
                let grabber = GrabberType::new(source).map_err(|e| {
                    ComputationError::Process(format!("Could not create grabber: {}", e))
                })?;
                self.content_grabber = Some(Box::new(grabber));
                SupportedFileType::Text
            }
            Some(SupportedFileType::Dlt) => {
                type GrabberType = processor::grabber::Grabber<DltSource>;
                let source = DltSource::new(&input_p, &source_id);
                let grabber = GrabberType::new(source).map_err(|e| {
                    ComputationError::Process(format!("Could not create grabber: {}", e))
                })?;
                self.content_grabber = Some(Box::new(grabber));
                SupportedFileType::Dlt
            }
            None => {
                return Err(ComputationError::OperationNotSupported(
                    "Unsupported file type".to_string(),
                ));
            }
        };
        self.op_channel
            .0
            .send(Operation::Assign {
                file_path,
                source_id,
                operation_id,
                source_type,
            })
            .map_err(|_| {
                ComputationError::Process("Could not send operation on channel".to_string())
            })?;
        Ok(operation_id.to_string())
    }
}

// TODO:
//         method grab_search_results(mut cx) {
//         method setFilters(mut cx) {
//         method getFilters(mut cx) {
//         method shutdown(mut cx) {

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct GeneralError {
    severity: Severity,
    message: String,
}

impl TryIntoJs for CallbackEvent {
    /// serialize into json object
    fn try_to_js(self, js_env: &JsEnv) -> Result<napi_value, NjError> {
        // create JSON

        match serde_json::to_string(&self) {
            Ok(s) => js_env.create_string_utf8(&s),
            Err(e) => Err(NjError::Other(format!(
                "Could not convert Callback event to json: {}",
                e
            ))),
        }
        // json.set_property("value", js_env.create_string_utf8(&s)?);
        // json.try_to_js(js_env)
    }
}
// impl JSValue<'_> for CallbackEvent {
// fn convert_to_rust(env: &JsEnv, n_value: napi_value) -> Result<Self, NjError> {
//     // check if it is integer
//     if let Ok(js_obj) = env.convert_to_rust::<JsObject>(n_value) {
//         if let Some(val_property) = js_obj.get_property("signature")? {
//             let signature = val_property.as_value::<String>()?;
//             match signature.as_str() {
//                 "StreamUpdated" => {
//                     let mut data = StreamUpdated::default();
//                     if let Some(val_property) = js_obj.get_property("bytes")? {
//                         data.bytes = val_property.as_value::<i32>()?;
//                     } else {
//                         return Err(NjError::Other("bytes is not found".to_owned()));
//                     }
//                     if let Some(val_property) = js_obj.get_property("rows")? {
//                         data.rows = val_property.as_value::<i32>()?;
//                     } else {
//                         return Err(NjError::Other("rows is not found".to_owned()));
//                     }
//                     Ok(Self::StreamUpdated(data))
//                 }
//                 "SearchUpdated" => {
//                     let mut data = SearchUpdated::default();
//                     if let Some(val_property) = js_obj.get_property("bytes")? {
//                         data.bytes = val_property.as_value::<i32>()?;
//                     } else {
//                         return Err(NjError::Other("bytes is not found".to_owned()));
//                     }
//                     if let Some(val_property) = js_obj.get_property("rows")? {
//                         data.rows = val_property.as_value::<i32>()?;
//                     } else {
//                         return Err(NjError::Other("rows is not found".to_owned()));
//                     }
//                     if let Some(val_property) = js_obj.get_property("done")? {
//                         data.done = val_property.as_value::<f64>()?;
//                     } else {
//                         return Err(NjError::Other("done is not found".to_owned()));
//                     }
//                     Ok(Self::SearchUpdated(data))
//                 }
//                 _ => Err(NjError::Other("Unknown event has been gotten".to_owned())),
//             }
//         } else {
//             Err(NjError::Other("Fail to find event signature".to_owned()))
//         }
//     } else {
//         Err(NjError::Other("not valid format".to_owned()))
//     }
// }
// }