use crate::traits::{error, parser::PhantomData, source};
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
}

impl Source {
    pub fn new(options: Options) -> Result<Self, Error> {
        Ok(Self {
            file: File::open(&options.path).map_err(|e| Error::Io(e.to_string()))?,
            path: options.path,
            pos: 0,
            buffer: vec![],
        })
    }

    fn read_next_segment(&mut self) -> Option<Result<(usize, usize), Error>> {
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
            if let Some(last) = self.buffer.iter().rposition(|b| *b == b'\n') {
                let breaks = bytecount::count(&self.buffer, b'\n');
                println!(
                    ">>>>>>>>>>> READ: {:?} Mb / {} Kb",
                    self.pos / 1024 / 1024,
                    self.buffer.len() / 1024
                );
                if breaks <= 1 {
                    Some(Ok((0, 0)))
                } else {
                    self.buffer = self.buffer[last..].to_vec();
                    Some(Ok((last, breaks - 1)))
                }
            } else {
                None
            }
        }
    }
}

#[async_trait]
impl source::Source<PhantomData, Error> for Source {
    fn get_output_file(&self) -> Option<PathBuf> {
        Some(self.path.clone())
    }
    async fn next_map(&mut self) -> Option<Result<(usize, usize), Error>> {
        self.read_next_segment()
    }
    fn is_mapper(&self) -> bool {
        true
    }
}
