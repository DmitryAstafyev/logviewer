use tokio::{sync::oneshot, task};
use uuid::Uuid;

mod error;
mod jobs;
mod signal;
mod tracker;

use error::OperationError;
use jobs::Job;
use tracker::Tracker;

pub struct UnboundJobs {
    tracker: Tracker,
}

impl UnboundJobs {
    pub fn new() -> Self {
        UnboundJobs {
            tracker: Tracker::new(),
        }
    }

    pub async fn shutdown(&self) -> Result<(), OperationError> {
        self.tracker.shutdown().await
    }

    pub async fn abort(&mut self, uuid: &Uuid) -> Result<(), OperationError> {
        let signal = self
            .tracker
            .get(*uuid)
            .await?
            .ok_or(OperationError::NoJob(uuid.to_string()))?;
        signal.abort().await;
        self.tracker.remove(*uuid).await?;
        Ok(())
    }

    async fn run(&mut self, job: Job) -> Result<Uuid, OperationError> {
        let (uuid, signal) = self.tracker.insert().await?;
        let tracker = self.tracker.clone();
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
            if let Err(_err) = tracker.remove(uuid).await {
                // logs
            }
        });
        Ok(uuid)
    }

    // We are using cb to delivery back to NodeJS a UUID of operation
    // to make possible to trigger cancelation of it from NodeJS.
    pub async fn some<F: Fn(String) + Send + 'static>(
        &mut self,
        cb: F,
        num: u64,
    ) -> Result<u64, OperationError> {
        let (tx, rx) = oneshot::channel();
        // Execute oparation and send back uuid of it
        cb(self.run(jobs::Job::SomeJob((tx, num))).await?.to_string());
        // Waiting for results of operation
        rx.await.map_err(|_| OperationError::Feedback)?
    }
}

impl Default for UnboundJobs {
    fn default() -> Self {
        Self::new()
    }
}
