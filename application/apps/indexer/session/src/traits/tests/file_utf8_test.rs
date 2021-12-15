use crate::traits::{
    collector,
    collector::Collector,
    parser,
    parsers::utf8_text,
    source,
    sources::{text_file, text_mapper},
};
use std::path::PathBuf;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tokio;

mod shortcuts {
    use super::*;

    pub fn get_timestamp() -> Duration {
        let start = SystemTime::now();
        start
            .duration_since(UNIX_EPOCH)
            .expect("Time went backwards")
    }
}
// #[tokio::test]
// async fn test_text_mapper() -> Result<(), String> {
//     let started = shortcuts::get_timestamp();
//     let p = utf8_text::Parser::new();
//     // let source = file::Source::new(
//     //     file::Options {
//     //         path: PathBuf::from("/storage/projects/esrlabs/logs-examples/biggest.log"),
//     //     },
//     //     Some(parser),
//     // )
//     // .map_err(|e| e.to_string())?;
//     let source = text_mapper::Source::new(text_mapper::Options {
//         path: PathBuf::from("/storage/projects/esrlabs/logs-examples/biggest.log"),
//     })
//     .map_err(|e| e.to_string())?;
//     let mut collector = Collector::new(source).await.map_err(|e| e.to_string())?;
//     while let Ok(event) = collector.next().await {
//         if let collector::Next::Empty = event {
//             break;
//         }
//     }
//     let finished = shortcuts::get_timestamp();
//     let duration = finished.as_millis() - started.as_millis();
//     println!(
//         ">>>>>>>>> Finished in {} millis / {} sec",
//         duration,
//         duration / 1000
//     );
//     Ok(())
// }

#[tokio::test]
async fn test_utf8_reader() -> Result<(), String> {
    let started = shortcuts::get_timestamp();
    let source = text_file::Source::new(
        text_file::Options {
            path: PathBuf::from("/storage/projects/esrlabs/logs-examples/biggest.log"),
        },
        utf8_text::Parser::new(),
    )
    .map_err(|e| e.to_string())?;
    let mut collector = Collector::new(source).await.map_err(|e| e.to_string())?;
    while let Ok(event) = collector.next().await {
        if let collector::Next::Empty = event {
            break;
        }
    }
    let finished = shortcuts::get_timestamp();
    let duration = finished.as_millis() - started.as_millis();
    println!(
        ">>>>>>>>> Finished in {} millis / {} sec",
        duration,
        duration / 1000
    );
    Ok(())
}
