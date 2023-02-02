use tokio_util::sync::CancellationToken;

pub async fn handler(signal: CancellationToken, num: u64) -> Result<u64, String> {
    Ok(num)
}
