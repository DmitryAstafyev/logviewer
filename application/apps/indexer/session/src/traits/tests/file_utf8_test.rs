use crate::traits::{collector::Collector, parsers::utf8_text, sources::file};
use std::path::PathBuf;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tokio;
use tokio::join;
use tokio_util::sync::CancellationToken;

mod shortcuts {
    use super::*;

    pub fn get_timestamp() -> Duration {
        let start = SystemTime::now();
        start
            .duration_since(UNIX_EPOCH)
            .expect("Time went backwards")
    }
}
#[tokio::test]
async fn test() -> Result<(), String> {
    let started = shortcuts::get_timestamp();
    let mut collector = Collector::new(
        PathBuf::from("/home/dmitry/tmp"),
        file::Source::new(),
        file::Options {
            path: PathBuf::from("/storage/projects/esrlabs/logs-examples/biggest.log"),
            buffer_size: 40 * 1024,
        },
        utf8_text::Parser::new(),
        utf8_text::Options {},
    )
    .await
    .map_err(|e| e.to_string())?;
    while let Ok(event) = collector.next().await {}
    let finished = shortcuts::get_timestamp();
    let duration = finished.as_millis() - started.as_millis();
    println!(
        ">>>>>>>>> Finished in {} millis / {} sec",
        duration,
        duration / 1000
    );
    Ok(())
}
