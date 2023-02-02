use serde::Serialize;
use thiserror::Error;
use tokio::task;
use uuid::Uuid;

mod jobs;
mod signal;
mod tracker;

use jobs::Job;
use tracker::Tracker;

#[derive(Error, Debug, Serialize)]
pub enum UnboundJobError {
    #[error("Fail to find job ({0})")]
    NoJob(String),
    #[error("{0}")]
    Channels(String),
}

pub struct UnboundJobs {
    tracker: Tracker,
}

impl UnboundJobs {
    pub fn new() -> Self {
        UnboundJobs {
            tracker: Tracker::new(),
        }
    }

    pub async fn shutdown(&self) -> Result<(), UnboundJobError> {
        self.tracker.shutdown().await
    }

    pub async fn abort(&mut self, uuid: &Uuid) -> Result<(), UnboundJobError> {
        let signal = self
            .tracker
            .get(*uuid)
            .await?
            .ok_or(UnboundJobError::NoJob(uuid.to_string()))?;
        signal.abort().await;
        self.tracker.remove(*uuid).await?;
        Ok(())
    }

    pub async fn run(&mut self, job: Job) -> Result<Uuid, UnboundJobError> {
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
}

impl Default for UnboundJobs {
    fn default() -> Self {
        Self::new()
    }
}
