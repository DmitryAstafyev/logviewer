use tokio::{
    sync::{
        mpsc::{unbounded_channel, UnboundedReceiver, UnboundedSender},
        oneshot,
    },
    task,
};
use tokio_util::sync::CancellationToken;
use uuid::Uuid;

mod error;
mod jobs;
mod signal;
mod tracker;

pub use error::OperationError;
use jobs::Job;
use tracker::Tracker;

enum Task {
    Run((Job, oneshot::Sender<Result<Uuid, OperationError>>)),
    Shutdown(CancellationToken),
}
pub struct UnboundJobs {
    tracker: Tracker,
    tx: Option<UnboundedSender<Task>>,
}

impl UnboundJobs {
    pub fn new() -> Self {
        UnboundJobs {
            tracker: Tracker::new(),
            tx: None,
        }
    }

    pub async fn init(&mut self) -> Result<(), OperationError> {
        let tracker = self.tracker.clone();
        let (tx, mut rx): (UnboundedSender<Task>, UnboundedReceiver<Task>) = unbounded_channel();
        self.tx = Some(tx);
        task::spawn(async move {
            while let Some(task) = rx.recv().await {
                match task {
                    Task::Run((job, tx)) => {
                        let (uuid, signal) = match tracker.insert().await {
                            Ok((uuid, signal)) => (uuid, signal),
                            Err(err) => {
                                if tx.send(Err(err)).is_err() {
                                    // logs
                                }
                                continue;
                            }
                        };
                        if tx.send(Ok(uuid)).is_err() {
                            // logs
                            continue;
                        }
                        let inner_tracker = tracker.clone();
                        task::spawn(async move {
                            let uuid = match job {
                                Job::SomeJob((tx, num)) => {
                                    let res = jobs::some::handler(signal.signal, num).await;
                                    if tx.send(res).is_err() {
                                        // logs
                                    }
                                    uuid
                                }
                            };
                            if let Err(_err) = inner_tracker.remove(uuid).await {
                                // logs
                            }
                        });
                    }
                    Task::Shutdown(token) => {
                        if let Err(_err) = tracker.shutdown().await {
                            // logs
                        }
                        token.cancel();
                        break;
                    }
                }
            }
        });
        Ok(())
    }

    pub async fn shutdown(&self) -> Result<(), OperationError> {
        if let Some(tx) = self.tx.as_ref() {
            let token = CancellationToken::new();
            tx.send(Task::Shutdown(token.clone())).map_err(|_| {
                OperationError::Channels(String::from("Fail to send Task::Shutdown"))
            })?;
            token.cancelled().await;
            Ok(())
        } else {
            Err(OperationError::TasksLoop)
        }
    }

    pub async fn abort(&self, uuid: &Uuid) -> Result<(), OperationError> {
        let signal = self
            .tracker
            .get(*uuid)
            .await?
            .ok_or(OperationError::NoJob(uuid.to_string()))?;
        signal.abort().await;
        self.tracker.remove(*uuid).await?;
        Ok(())
    }

    async fn run<F: Fn(String) + Send + 'static>(
        &self,
        cb: F,
        job: Job,
    ) -> Result<(), OperationError> {
        if let Some(tx) = self.tx.as_ref() {
            let (tx_task, rx_task) = oneshot::channel();
            tx.send(Task::Run((job, tx_task)))
                .map_err(|_| OperationError::Channels(String::from("Fail to send Task::Run")))?;
            let uuid = rx_task.await.map_err(|_| {
                OperationError::Channels(String::from(
                    "Fail to get uuid of operation from Task::Run",
                ))
            })??;
            cb(uuid.to_string());
            Ok(())
        } else {
            Err(OperationError::TasksLoop)
        }
    }

    // We are using cb to delivery back to NodeJS a UUID of operation
    // to make possible to trigger cancelation of it from NodeJS.
    pub async fn some<F: Fn(String) + Send + 'static>(
        &self,
        cb: F,
        num: u64,
    ) -> Result<u64, OperationError> {
        let (tx, rx) = oneshot::channel();
        // Execute oparation
        self.run(cb, jobs::Job::SomeJob((tx, num))).await?;
        // Waiting for results of operation
        rx.await.map_err(|_| OperationError::Feedback)?
    }
}

impl Default for UnboundJobs {
    fn default() -> Self {
        Self::new()
    }
}
