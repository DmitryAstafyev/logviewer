use crate::error::OperationError;
use tokio::{
    select,
    time::{sleep, Duration},
};
use tokio_util::sync::CancellationToken;

pub async fn handler(signal: CancellationToken, num: u64) -> Result<u64, OperationError> {
    select! {
        _ = signal.cancelled() => {
            Ok(0)
        }
        _ = sleep(Duration::from_millis(3000)) => {
            Ok(num * 2)
        }
    }
}
