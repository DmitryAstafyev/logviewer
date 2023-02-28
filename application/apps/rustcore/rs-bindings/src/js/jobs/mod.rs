use log::error;
use node_bindgen::derive::node_bindgen;
use std::thread;
use tokio::{runtime::Runtime, sync::oneshot};
use tokio_util::sync::CancellationToken;
use unbound::{OperationError, UnboundJobs};
use uuid::Uuid;

mod error;

use error::OperationErrorWrapper;

fn uuid_from_str(operation_id: &str) -> Result<Uuid, OperationError> {
    match Uuid::parse_str(operation_id) {
        Ok(uuid) => Ok(uuid),
        Err(e) => Err(OperationError::Other(format!(
            "Fail to parse operation uuid from {operation_id}. Error: {e}"
        ))),
    }
}

struct Jobs {
    session: Option<UnboundJobs>,
    token: CancellationToken,
}

#[node_bindgen]
impl Jobs {
    #[node_bindgen(constructor)]
    pub fn new() -> Self {
        Self {
            session: None,
            token: CancellationToken::new(),
        }
    }

    #[node_bindgen(mt)]
    async fn init(&mut self) -> Result<(), OperationErrorWrapper> {
        let rt = Runtime::new()
            .map_err(|e| OperationError::Other(format!("Could not start tokio runtime: {e}")))?;
        let (tx, rx): (oneshot::Sender<UnboundJobs>, oneshot::Receiver<UnboundJobs>) =
            oneshot::channel();
        let token = self.token.clone();
        thread::spawn(move || {
            rt.block_on(async {
                let mut jobs = UnboundJobs::new();
                if let Err(err) = jobs.init().await {
                    error!("Fail to init UnboundJobs: {err}");
                    return;
                }
                println!(">>>>>>>>>>>>>>>> Jobs is created and inited");
                if tx.send(jobs).is_err() {
                    error!("Fail to create UnboundJobs because channel problems");
                }
                token.cancelled().await;
                println!(">>>>>>>>>>>>>>>> Runtime exit");
            })
        });
        self.session = Some(rx.await.map_err(|_| {
            OperationErrorWrapper(OperationError::Other(String::from(
                "Fail to get session instance to setup",
            )))
        })?);
        Ok(())
    }

    #[node_bindgen]
    async fn destroy(&self) -> Result<(), OperationErrorWrapper> {
        if let Some(session) = self.session.as_ref() {
            session.shutdown().await.map_err(OperationErrorWrapper)?;
            self.token.cancel();
            Ok(())
        } else {
            Err(OperationErrorWrapper(OperationError::SessionUnavailable))
        }
    }

    #[node_bindgen]
    async fn abort(&self, operation_id: String) -> Result<(), OperationErrorWrapper> {
        if let Some(session) = self.session.as_ref() {
            session
                .abort(&uuid_from_str(&operation_id)?)
                .await
                .map_err(OperationErrorWrapper)?;
            Ok(())
        } else {
            Err(OperationErrorWrapper(OperationError::SessionUnavailable))
        }
    }

    #[node_bindgen]
    async fn some<F: Fn(String) + Send + 'static>(
        &self,
        cb: F,
        num: i64,
    ) -> Result<i64, OperationErrorWrapper> {
        if let Some(session) = self.session.as_ref() {
            let res = session
                .some(cb, num as u64)
                .await
                .map_err(OperationErrorWrapper)?;
            Ok(res as i64)
        } else {
            Err(OperationErrorWrapper(OperationError::SessionUnavailable))
        }
    }
}
