pub mod api;
pub mod commands;
mod signal;

use crate::{
    events::{ComputationError, LifecycleTransition},
    unbound::{
        api::{UnboundSessionAPI, API},
        signal::Signal,
    },
    TRACKER_CHANNEL,
};
use log::{debug, error, warn};
use std::collections::HashMap;
use tokio::sync::mpsc::{unbounded_channel, UnboundedReceiver, UnboundedSender};
use tokio_util::sync::CancellationToken;
use uuid::Uuid;

pub struct UnboundSession {
    rx: Option<UnboundedReceiver<API>>,
    pub finished: CancellationToken,
    session_api: UnboundSessionAPI,
}

impl UnboundSession {
    pub fn new() -> (Self, UnboundSessionAPI) {
        let (tx, rx): (UnboundedSender<API>, UnboundedReceiver<API>) = unbounded_channel();
        let session_api = UnboundSessionAPI::new(tx);
        (
            Self {
                rx: Some(rx),
                finished: CancellationToken::new(),
                session_api: session_api.clone(),
            },
            session_api,
        )
    }

    pub async fn init(&mut self) -> Result<(), ComputationError> {
        let finished = self.finished.clone();
        let mut rx = self.rx.take().ok_or(ComputationError::SessionUnavailable)?; // Error: session already running
        let tracker_tx = TRACKER_CHANNEL
            .lock()
            .map(|channels| channels.0.clone())
            .map_err(|e| {
                ComputationError::Process(format!(
                    "Could not start an unbound session, tracker_tx unavailable {e}"
                ))
            })?;
        let session_api = self.session_api.clone();
        tokio::spawn(async move {
            let mut jobs: HashMap<u64, Signal> = HashMap::new();
            let mut uuids: HashMap<u64, Uuid> = HashMap::new();
            while let Some(api) = rx.recv().await {
                jobs.retain(|id, signal| {
                    let cancelled = signal.is_cancelled();
                    if cancelled {
                        UnboundSession::stopped(&tracker_tx, &mut uuids, id);
                    }
                    !cancelled
                });
                match api {
                    API::Run(job, id) => {
                        let signal = Signal::new(job.to_string());
                        if jobs.contains_key(&id) {
                            crate::unbound::commands::err(
                                job,
                                ComputationError::InvalidArgs(String::from(
                                    "Job has invalid id. Id already exists.",
                                )),
                            )
                            .await;
                            continue;
                        }
                        jobs.insert(id, signal.clone());
                        UnboundSession::started(&tracker_tx, &mut uuids, &id);
                        let api = session_api.clone();
                        tokio::spawn(async move {
                            debug!("Job {job} has been called");
                            crate::unbound::commands::process(job, signal.clone()).await;
                            signal.confirm();
                            let _ = api.remove_command(id);
                        });
                    }
                    API::CancelJob(id) => {
                        if let Some(signal) = jobs.get(&id) {
                            signal.invoke();
                            debug!("Cancel signal has been sent to job {} ({id})", signal.alias);
                        } else {
                            warn!("Fail to cancel job; id {id} doesn't exist.");
                        }
                    }
                    API::Shutdown(tx) => {
                        jobs.iter().for_each(|(_uuid, signal)| {
                            signal.invoke();
                        });
                        for (id, signal) in jobs.iter() {
                            signal.confirmed().await;
                            UnboundSession::stopped(&tracker_tx, &mut uuids, id);
                        }
                        jobs.clear();
                        if tx.send(()).is_err() {
                            error!("Fail to send shutdown confirmation");
                        }
                        break;
                    }
                    API::Remove(id) => {
                        if jobs.remove(&id).is_some() {
                            UnboundSession::stopped(&tracker_tx, &mut uuids, &id);
                        }
                    }
                }
            }
            finished.cancel();
        });
        Ok(())
    }

    fn started(
        tx: &UnboundedSender<LifecycleTransition>,
        uuids: &mut HashMap<u64, Uuid>,
        id: &u64,
    ) {
        let uuid = Uuid::new_v4();
        uuids.insert(*id, uuid);
        if tx.send(LifecycleTransition::Started(uuid)).is_err() {
            error!("Fail to send LifecycleTransition::Started to operations tracker");
        }
    }

    fn stopped(
        tx: &UnboundedSender<LifecycleTransition>,
        uuids: &mut HashMap<u64, Uuid>,
        id: &u64,
    ) {
        if let Some(uuid) = uuids.get(id) {
            if tx.send(LifecycleTransition::Stopped(*uuid)).is_err() {
                error!("Fail to send LifecycleTransition::Stopped to operations tracker");
            }
        } else {
            error!("Fail to find UUID for operation id={id}");
        }
    }
}
