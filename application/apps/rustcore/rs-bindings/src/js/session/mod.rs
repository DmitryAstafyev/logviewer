pub mod events;

use crate::{
    js::{
        converting::{
            concat::WrappedConcatenatorInput, filter::WrappedSearchFilter,
            merge::WrappedFileMergeOptions,
        },
        session::events::{callback_event_loop, ComputationErrorWrapper},
    },
    logging::targets,
};
use crossbeam_channel as cc;
use events::CallbackEventWrapper;
use log::{error, info};
use node_bindgen::derive::node_bindgen;
use session::{
    events::{CallbackEvent, ComputationError},
    operations,
    session::{OperationsChannel, Session},
    state::{self, SessionStateAPI},
};
use std::thread;
use tokio::{
    join,
    runtime::Runtime,
    sync::mpsc::{unbounded_channel, UnboundedReceiver, UnboundedSender},
};

struct RustSession(Session);

#[node_bindgen]
impl RustSession {
    #[node_bindgen(constructor)]
    pub fn new(id: String) -> Self {
        let (tx_operations, rx_operations): OperationsChannel = unbounded_channel();
        let (state_api, rx_state_api) = SessionStateAPI::new();
        Self(Session {
            id,
            running: false,
            content_grabber: None,
            search_grabber: None,
            tx_operations,
            rx_operations: Some(rx_operations),
            rx_state_api: Some(rx_state_api),
            state_api: Some(state_api),
            search_metadata_channel: cc::unbounded(),
        })
    }

    #[node_bindgen(getter)]
    fn id(&self) -> String {
        self.0.id.clone()
    }

    #[node_bindgen]
    fn abort(
        &mut self,
        operation_id: String,
        target_id: String,
    ) -> Result<(), ComputationErrorWrapper> {
        let _ = self.0.tx_operations.send((
            operations::uuid_from_str(&operation_id)?,
            operations::Operation::Cancel {
                target: operations::uuid_from_str(&target_id)?,
            },
        ));
        Ok(())
    }

    /// this will start of the event loop that processes different rust operations
    /// in the event-loop-thread
    /// the callback is used to report back to javascript
    #[node_bindgen(mt)]
    fn start<F: Fn(CallbackEventWrapper) + Send + 'static>(
        &mut self,
        callback: F,
    ) -> Result<(), ComputationErrorWrapper> {
        let rt = Runtime::new().map_err(|e| {
            ComputationError::Process(format!("Could not start tokio runtime: {}", e))
        })?;
        let rx_operations = if let Some(rx_operations) = self.0.rx_operations.take() {
            rx_operations
        } else {
            return Err(ComputationError::MultipleInitCall.into());
        };
        self.0.running = true;
        let state_api = if let Some(state_api) = self.0.state_api.as_ref() {
            state_api.clone()
        } else {
            return Err(ComputationError::MultipleInitCall.into());
        };
        let rx_state_api = if let Some(rx_state_api) = self.0.rx_state_api.take() {
            rx_state_api
        } else {
            return Err(ComputationError::MultipleInitCall.into());
        };
        let search_metadata_tx = self.0.search_metadata_channel.0.clone();
        thread::spawn(move || {
            rt.block_on(async {
                info!(target: targets::SESSION, "started");
                let (tx_callback_events, rx_callback_events): (
                    UnboundedSender<CallbackEvent>,
                    UnboundedReceiver<CallbackEvent>,
                ) = unbounded_channel();
                let state_shutdown_token = state_api.get_shutdown_token();
                let (_, _) = join!(
                    async move {
                        let (_, _) = join!(
                            operations::task(
                                rx_operations,
                                state_api.clone(),
                                search_metadata_tx,
                                tx_callback_events
                            ),
                            callback_event_loop(callback, rx_callback_events),
                        );
                        if let Err(err) = state_api.shutdown() {
                            error!(
                                target: targets::SESSION,
                                "fail to call state shutdown: {:?}", err
                            );
                        }
                    },
                    state::task(rx_state_api, state_shutdown_token),
                );
                info!(target: targets::SESSION, "finished");
            })
        });
        Ok(())
    }

    #[node_bindgen]
    async fn get_stream_len(&mut self) -> Result<i64, ComputationErrorWrapper> {
        self.0.get_stream_len().await.map_err(|e| e.into())
    }

    #[node_bindgen]
    async fn get_search_len(&mut self) -> Result<i64, ComputationErrorWrapper> {
        self.0.get_search_len().await.map_err(|e| e.into())
    }

    #[node_bindgen]
    async fn grab(
        &mut self,
        start_line_index: i64,
        number_of_lines: i64,
    ) -> Result<String, ComputationErrorWrapper> {
        self.0
            .grab(start_line_index, number_of_lines)
            .await
            .map_err(|e| e.into())
    }

    #[node_bindgen]
    fn stop(&mut self, operation_id: String) -> Result<(), ComputationErrorWrapper> {
        self.0.stop(operation_id).map_err(|e| e.into())
    }

    #[node_bindgen]
    async fn assign(
        &mut self,
        file_path: String,
        source_id: String,
        operation_id: String,
    ) -> Result<(), ComputationErrorWrapper> {
        self.0
            .assign(file_path, source_id, operation_id)
            .await
            .map_err(|e| e.into())
    }

    #[node_bindgen]
    async fn grab_search(
        &mut self,
        start_line_index: i64,
        number_of_lines: i64,
    ) -> Result<String, ComputationErrorWrapper> {
        self.0
            .grab_search(start_line_index, number_of_lines)
            .await
            .map_err(|e| e.into())
    }

    #[node_bindgen]
    async fn apply_search_filters(
        &mut self,
        filters: Vec<WrappedSearchFilter>,
        operation_id: String,
    ) -> Result<(), ComputationErrorWrapper> {
        self.0
            .apply_search_filters(
                filters.iter().map(|f| f.as_filter()).collect(),
                operation_id,
            )
            .await
            .map_err(|e| e.into())
    }

    #[node_bindgen]
    async fn extract_matches(
        &mut self,
        filters: Vec<WrappedSearchFilter>,
        operation_id: String,
    ) -> Result<(), ComputationErrorWrapper> {
        self.0
            .extract_matches(
                filters.iter().map(|f| f.as_filter()).collect(),
                operation_id,
            )
            .await
            .map_err(|e| e.into())
    }

    #[node_bindgen]
    async fn get_map(
        &mut self,
        operation_id: String,
        dataset_len: i32,
        from: Option<i64>,
        to: Option<i64>,
    ) -> Result<String, ComputationErrorWrapper> {
        self.0
            .get_map(operation_id, dataset_len, from, to)
            .await
            .map_err(|e| e.into())
    }

    #[node_bindgen]
    async fn get_nearest_to(
        &mut self,
        operation_id: String,
        position_in_stream: i64,
    ) -> Result<(), ComputationErrorWrapper> {
        self.0
            .get_nearest_to(operation_id, position_in_stream)
            .await
            .map_err(|e| e.into())
    }

    #[node_bindgen]
    async fn concat(
        &mut self,
        files: Vec<WrappedConcatenatorInput>,
        append: bool,
        operation_id: String,
    ) -> Result<(), ComputationErrorWrapper> {
        self.0
            .concat(
                files
                    .iter()
                    .map(|file| file.as_concatenator_input())
                    .collect(),
                append,
                operation_id,
            )
            .await
            .map_err(|e| e.into())
    }

    #[node_bindgen]
    async fn merge(
        &mut self,
        files: Vec<WrappedFileMergeOptions>,
        append: bool,
        operation_id: String,
    ) -> Result<(), ComputationErrorWrapper> {
        self.0
            .merge(
                files
                    .iter()
                    .map(|file| file.as_file_merge_options())
                    .collect(),
                append,
                operation_id,
            )
            .await
            .map_err(|e| e.into())
    }

    #[node_bindgen]
    async fn set_debug(&mut self, debug: bool) -> Result<(), ComputationErrorWrapper> {
        self.0.set_debug(debug).await.map_err(|e| e.into())
    }

    #[node_bindgen]
    async fn get_operations_stat(&mut self) -> Result<String, ComputationErrorWrapper> {
        self.0.get_operations_stat().await.map_err(|e| e.into())
    }

    #[node_bindgen]
    async fn sleep(
        &mut self,
        operation_id: String,
        ms: i64,
    ) -> Result<(), ComputationErrorWrapper> {
        self.0.sleep(operation_id, ms).await.map_err(|e| e.into())
    }
}
