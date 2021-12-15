use crate::traits::{
    error, map,
    map::Map,
    parser,
    parser::{Data, Parser},
};
use std::{fs, io, ops::Range, path::PathBuf, str::Utf8Error};
use thiserror::Error as ThisError;
use tokio::{fs::File, io::AsyncWriteExt};

#[derive(ThisError, Debug)]
pub enum Error {
    #[error("IO error: {0}")]
    Io(io::Error),
}

pub struct Output {
    file: File,
    map: Map,
}

impl Output {
    pub async fn new(path: PathBuf) -> Result<Self, Error> {
        let file = if path.exists() {
            File::open(&path).await.map_err(Error::Io)?
        } else {
            File::create(&path).await.map_err(Error::Io)?
        };
        Ok(Output {
            file,
            map: Map::new(),
        })
    }

    pub async fn content<D: Data>(&mut self, data: D) -> Result<usize, Error> {
        let rows = data.as_strings();
        let output_str = rows.join("\n");
        let output_bytes = output_str.as_bytes();
        //self.file.write_all(output_bytes).await.map_err(Error::Io)?;
        self.map.push(output_bytes.len(), rows.len());
        Ok(self.map.get_rows_count())
    }

    pub async fn map(&mut self, bytes: usize, rows: usize) -> Result<usize, Error> {
        self.map.push(bytes, rows);
        Ok(self.map.get_rows_count())
    }

    pub fn report(&self) {
        println!("{}", "=".repeat(60));
        println!("{}", self.map.report());
        println!("{}", "=".repeat(60));
    }
}
