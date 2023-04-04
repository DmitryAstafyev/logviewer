mod cancel_test;
mod checksum;
mod dlt;
mod folder;
mod process;
mod regex;
mod serial;
mod shells;

use crate::events::ComputationError;

use log::{error, trace};
use processor::search::filter::SearchFilter;
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
        usize,
        oneshot::Sender<Result<CommandOutcome<String>, ComputationError>>,
    ),
    SpawnProcess(
        String,
        Vec<String>,
        oneshot::Sender<Result<CommandOutcome<()>, ComputationError>>,
    ),
    GetRegexError(
        SearchFilter,
        oneshot::Sender<Result<CommandOutcome<Option<String>>, ComputationError>>,
    ),
    Checksum(
        String,
        oneshot::Sender<Result<CommandOutcome<String>, ComputationError>>,
    ),
    GetDltStats(
        Vec<String>,
        oneshot::Sender<Result<CommandOutcome<String>, ComputationError>>,
    ),
    GetShellProfiles(oneshot::Sender<Result<CommandOutcome<String>, ComputationError>>),
    GetContextEnvvars(oneshot::Sender<Result<CommandOutcome<String>, ComputationError>>),
    SerialPortsList(oneshot::Sender<Result<CommandOutcome<Vec<String>>, ComputationError>>),
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
                Command::SpawnProcess(_, _, _) => "SpawnProcess",
                Command::FolderContent(_, _, _) => "FolderContent",
                Command::GetShellProfiles(_) => "GetShellProfiles",
                Command::GetContextEnvvars(_) => "GetContextEnvvars",
                Command::SerialPortsList(_) => "SerialPortsList",
                Command::Checksum(_, _) => "Checksum",
                Command::GetDltStats(_, _) => "GetDltStats",
                Command::GetRegexError(_, _) => "GetRegexError",
            }
        )
    }
}

pub async fn process(command: Command, signal: Signal) {
    let cmd = command.to_string();
    trace!("Processing command: {cmd}");
    if match command {
        Command::FolderContent(path, depth, tx) => tx
            .send(folder::get_folder_content(&path, depth, signal))
            .is_err(),
        Command::SpawnProcess(path, args, tx) => {
            tx.send(process::execute(path, args, signal)).is_err()
        }
        Command::GetRegexError(filter, tx) => {
            tx.send(regex::get_filter_error(filter, signal)).is_err()
        }
        Command::Checksum(file, tx) => tx.send(checksum::checksum(&file, signal)).is_err(),
        Command::GetDltStats(files, tx) => tx.send(dlt::stats(files, signal)).is_err(),
        Command::GetShellProfiles(tx) => tx.send(shells::get_valid_profiles(signal)).is_err(),
        Command::GetContextEnvvars(tx) => tx.send(shells::get_context_envvars(signal)).is_err(),
        Command::SerialPortsList(tx) => tx.send(serial::available_ports(signal)).is_err(),
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
        Command::FolderContent(_path, _depth, tx) => tx.send(Err(err)).is_err(),
        Command::SpawnProcess(_path, _args, tx) => tx.send(Err(err)).is_err(),
        Command::GetRegexError(_filter, tx) => tx.send(Err(err)).is_err(),
        Command::Checksum(_file, tx) => tx.send(Err(err)).is_err(),
        Command::GetDltStats(_files, tx) => tx.send(Err(err)).is_err(),
        Command::GetShellProfiles(tx) => tx.send(Err(err)).is_err(),
        Command::GetContextEnvvars(tx) => tx.send(Err(err)).is_err(),
        Command::SerialPortsList(tx) => tx.send(Err(err)).is_err(),
        Command::CancelTest(_a, _b, tx) => tx.send(Err(err)).is_err(),
    } {
        error!("Fail to send error response for command: {cmd}");
    }
}
