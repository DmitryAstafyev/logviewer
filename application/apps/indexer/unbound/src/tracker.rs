use crate::{signal::Signal, UnboundJobError};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use thiserror::Error;
use tokio::{
    join,
    sync::{
        mpsc::{unbounded_channel, UnboundedReceiver, UnboundedSender},
        oneshot,
    },
    task,
};
use tokio_util::sync::CancellationToken;
use uuid::Uuid;

pub enum TrackerAPI {
    CreateSignal(oneshot::Sender<(Uuid, Signal)>),
    RemoveSignal((Uuid, oneshot::Sender<bool>)),
    GetSignal((Uuid, oneshot::Sender<Option<Signal>>)),
    Shutdown(oneshot::Sender<()>),
}
#[derive(Debug, Clone)]
pub struct Tracker {
    tx: UnboundedSender<TrackerAPI>,
}

impl Tracker {
    pub fn new() -> Self {
        let (tx, mut rx): (UnboundedSender<TrackerAPI>, UnboundedReceiver<TrackerAPI>) =
            unbounded_channel();
        task::spawn(async move {
            let mut signals: HashMap<Uuid, Signal> = HashMap::new();
            while let Some(msg) = rx.recv().await {
                match msg {
                    TrackerAPI::CreateSignal(tx) => {
                        let signal = Signal::new();
                        let uuid = Uuid::new_v4();
                        signals.insert(uuid, signal.clone());
                        if tx.send((uuid, signal)).is_err() {
                            break;
                        }
                    }
                    TrackerAPI::RemoveSignal((uuid, tx)) => {
                        if tx
                            .send(if let Some(signal) = signals.remove(&uuid) {
                                signal.confirm();
                                true
                            } else {
                                false
                            })
                            .is_err()
                        {
                            break;
                        }
                    }
                    TrackerAPI::GetSignal((uuid, tx)) => {
                        if tx.send(signals.get(&uuid).cloned()).is_err() {
                            break;
                        }
                    }
                    TrackerAPI::Shutdown(tx) => {
                        for (_uuid, signal) in signals.iter() {
                            signal.abort().await;
                        }
                        if tx.send(()).is_err() {
                            // logs
                        }
                        break;
                    }
                }
            }
        });
        Tracker { tx }
    }

    pub async fn insert(&self) -> Result<(Uuid, Signal), UnboundJobError> {
        let (tx, rx): (
            oneshot::Sender<(Uuid, Signal)>,
            oneshot::Receiver<(Uuid, Signal)>,
        ) = oneshot::channel();
        self.tx.send(TrackerAPI::CreateSignal(tx)).map_err(|_| {
            UnboundJobError::Channels(String::from("Fail to send TrackerAPI::CreateSignal"))
        })?;
        rx.await.map_err(|_| {
            UnboundJobError::Channels(String::from(
                "Fail to get response from TrackerAPI::CreateSignal",
            ))
        })
    }

    pub async fn remove(&self, uuid: Uuid) -> Result<bool, UnboundJobError> {
        let (tx, rx): (oneshot::Sender<bool>, oneshot::Receiver<bool>) = oneshot::channel();
        self.tx
            .send(TrackerAPI::RemoveSignal((uuid, tx)))
            .map_err(|_| {
                UnboundJobError::Channels(String::from("Fail to send TrackerAPI::RemoveSignal"))
            })?;
        rx.await.map_err(|_| {
            UnboundJobError::Channels(String::from(
                "Fail to get response from TrackerAPI::RemoveSignal",
            ))
        })
    }

    pub async fn get(&self, uuid: Uuid) -> Result<Option<Signal>, UnboundJobError> {
        let (tx, rx): (
            oneshot::Sender<Option<Signal>>,
            oneshot::Receiver<Option<Signal>>,
        ) = oneshot::channel();
        self.tx
            .send(TrackerAPI::GetSignal((uuid, tx)))
            .map_err(|_| {
                UnboundJobError::Channels(String::from("Fail to send TrackerAPI::GetSignal"))
            })?;
        rx.await.map_err(|_| {
            UnboundJobError::Channels(String::from(
                "Fail to get response from TrackerAPI::GetSignal",
            ))
        })
    }

    pub async fn shutdown(&self) -> Result<(), UnboundJobError> {
        let (tx, rx): (oneshot::Sender<()>, oneshot::Receiver<()>) = oneshot::channel();
        self.tx.send(TrackerAPI::Shutdown(tx)).map_err(|_| {
            UnboundJobError::Channels(String::from("Fail to send TrackerAPI::Shutdown"))
        })?;
        rx.await.map_err(|_| {
            UnboundJobError::Channels(String::from(
                "Fail to get response from TrackerAPI::Shutdown",
            ))
        })
    }
}
