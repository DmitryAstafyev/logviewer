use crate::error::OperationError;
use tokio_util::sync::CancellationToken;

pub async fn handler(_signal: CancellationToken, num: u64) -> Result<u64, OperationError> {
    Ok(num)
}
