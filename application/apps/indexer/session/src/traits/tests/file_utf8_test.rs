use crate::traits::{
    collector,
    collector::Collector,
    parser,
    parsers::utf8_text,
    source,
    sources::{text_file, text_mapper},
};
use console::style;
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

fn title(title: &str) {
    println!("\n{}", "=".repeat(60));
    println!("{}: {}", style("[source]").bold().dim(), title);
    println!("{}\n", "=".repeat(60));
}
#[tokio::test]
async fn test_text_mapper() -> Result<(), String> {
    title("mapper");
    let started = shortcuts::get_timestamp();
    let source = text_mapper::Source::new(text_mapper::Options {
        path: PathBuf::from("/storage/projects/esrlabs/logs-examples/biggest.log"),
    })
    .map_err(|e| e.to_string())?;
    let mut collector = Collector::new(source).await.map_err(|e| e.to_string())?;
    while let Ok(event) = collector.next().await {
        if let collector::Next::Empty = event {
            break;
        }
    }
    let finished = shortcuts::get_timestamp();
    let duration = finished.as_millis() - started.as_millis();
    println!("{}: {} millis", style("[duration]").bold().dim(), duration);
    println!(
        "{}: {} sec",
        style("[duration]").bold().dim(),
        duration / 1000
    );
    Ok(())
}

#[tokio::test]
async fn test_utf8_reader() -> Result<(), String> {
    title("reader");
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
    println!("{}: {} millis", style("[duration]").bold().dim(), duration);
    println!(
        "{}: {} sec",
        style("[duration]").bold().dim(),
        duration / 1000
    );
    Ok(())
}
