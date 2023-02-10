use crate::error::OperationError;
use tokio::sync::oneshot;

pub mod some;

pub enum Job {
    SomeJob((oneshot::Sender<Result<u64, OperationError>>, u64)),
}
