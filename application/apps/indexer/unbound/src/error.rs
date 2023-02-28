use serde::Serialize;
use thiserror::Error;

#[derive(Error, Debug, Serialize)]
pub enum OperationError {
    #[error("Fail to find job ({0})")]
    NoJob(String),
    #[error("{0}")]
    Channels(String),
    #[error("Error during executing operation: ({0})")]
    Executing(String),
    #[error("Fail to get response from operation runner")]
    Feedback,
    #[error("{0}")]
    Other(String),
    #[error("Session isn't inited")]
    SessionUnavailable,
    #[error("Tasks loop doesn't exists")]
    TasksLoop,
}
