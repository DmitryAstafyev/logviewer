use crate::traits::{
    error,
    parser::{Data, Parser},
    parsers::utf8_text,
    source,
};
use async_trait::async_trait;
use std::{
    fs::File,
    io::{Read, Seek, SeekFrom},
    path::PathBuf,
};
use thiserror::Error as ThisError;

const READ_BUFFER_SIZE: usize = 50 * 1024;

#[derive(ThisError, Debug, Clone)]
pub enum Error {
    #[error("IO error: {0}")]
    Io(String),
    #[error("Parser error: {0}")]
    Parser(String),
    #[error("Not implemented/supported functionality")]
    NotSupported,
}

impl error::Error for Error {}

#[derive(Clone, Debug)]
pub struct Options {
    pub path: PathBuf,
}

pub struct Source {
    path: PathBuf,
    file: File,
    buffer: Vec<u8>,
    pos: u64,
    parser: utf8_text::Parser,
}

impl Source {
    pub fn new(options: Options, parser: utf8_text::Parser) -> Result<Self, Error> {
        Ok(Self {
            file: File::open(&options.path).map_err(|e| Error::Io(e.to_string()))?,
            path: options.path,
            pos: 0,
            parser,
            buffer: vec![],
        })
    }

    fn read_next_segment(&mut self) -> Option<Result<utf8_text::Utf8Entity, Error>> {
        if let Err(err) = self.file.seek(SeekFrom::Start(self.pos)) {
            return Some(Err(Error::Io(err.to_string())));
        }
        let mut buffer = [0; READ_BUFFER_SIZE];
        let len = match self.file.read(&mut buffer) {
            Ok(len) => len,
            Err(err) => {
                return Some(Err(Error::Io(err.to_string())));
            }
        };
        self.buffer.append(&mut buffer[..len].to_vec());
        if len == 0 {
            println!(">>>>>>>>>>> READ DONE: {:?} Mb", self.pos / 1024 / 1024);
            None
        } else {
            self.pos += len as u64;
            println!(">>>>>>>>>>> READ DONE: {:?} Mb", self.pos / 1024 / 1024);
            match self.parser.decode(&self.buffer, None) {
                Ok(result) => {
                    if let Some(entity) = result {
                        self.buffer = entity.get_rest().to_vec();
                        Some(Ok(entity))
                    } else {
                        None
                    }
                }
                Err(err) => Some(Err(Error::Parser(err.to_string()))),
            }
        }
    }
}

#[async_trait]
impl source::Source<utf8_text::Utf8Entity, Error> for Source {
    fn get_output_file(&self) -> Option<PathBuf> {
        Some(self.path.clone())
    }
    async fn next(&mut self) -> Option<Result<utf8_text::Utf8Entity, Error>> {
        self.read_next_segment()
    }
}
