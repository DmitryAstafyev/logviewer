mod cancel_test;
mod folder;

use crate::events::ComputationError;

use log::{error, trace};
use serde::{Deserialize, Serialize};
use tokio::sync::oneshot;
use uuid::Uuid;

use super::signal::Signal;

#[derive(Debug, Serialize, Deserialize)]
pub enum CommandOutcome<T> {
    Finished(T),
    Cancelled,
}

#[derive(Debug, Serialize, Deserialize)]
pub enum UuidCommandOutcome<T: Serialize> {
    Finished((Uuid, T)),
    Cancelled(Uuid),
}

impl<T: Serialize> CommandOutcome<T> {
    pub fn as_command_result(self, uuid: Uuid) -> UuidCommandOutcome<T> {
        match self {
            CommandOutcome::Cancelled => UuidCommandOutcome::Cancelled(uuid),
            CommandOutcome::Finished(c) => UuidCommandOutcome::Finished((uuid, c)),
        }
    }
}

#[derive(Debug)]
pub enum Command {
    FolderContent(
        String,
        oneshot::Sender<Result<CommandOutcome<String>, ComputationError>>,
    ),
    CancelTest(
        i64,
        i64,
        oneshot::Sender<Result<CommandOutcome<i64>, ComputationError>>,
    ),
}

impl std::fmt::Display for Command {
    fn fmt(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
        write!(
            f,
            "{}",
            match self {
                Command::CancelTest(_, _, _) => "CancelTest",
                Command::FolderContent(_, _) => "FolderContent",
            }
        )
    }
}

pub async fn process(command: Command, signal: Signal) {
    let cmd = command.to_string();
    trace!("Processing command: {cmd}");
    if match command {
        Command::FolderContent(path, tx) => {
            tx.send(folder::get_folder_content(&path, signal)).is_err()
        }
        Command::CancelTest(a, b, tx) => tx
            .send(cancel_test::cancel_test(a, b, signal).await)
            .is_err(),
    } {
        error!("Fail to send response for command: {cmd}");
    }
}

pub async fn err(command: Command, err: ComputationError) {
    let cmd = command.to_string();
    if match command {
        Command::FolderContent(_path, tx) => tx.send(Err(err)).is_err(),
        Command::CancelTest(_a, _b, tx) => tx.send(Err(err)).is_err(),
    } {
        error!("Fail to send error response for command: {cmd}");
    }
}
