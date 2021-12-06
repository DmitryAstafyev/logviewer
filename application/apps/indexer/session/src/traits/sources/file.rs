use crate::traits::{error, source};
use async_trait::async_trait;
use bytes::BytesMut;
use encoding_rs_io::*;
use std::{
    fs::File,
    io::{BufRead, BufReader, Read, Seek, SeekFrom},
    path::PathBuf,
};
use thiserror::Error as ThisError;
use tokio::{
    join, select,
    sync::{
        mpsc::{channel, unbounded_channel, Receiver, Sender, UnboundedReceiver, UnboundedSender},
        oneshot,
    },
};
use tokio_util::sync::CancellationToken;

const READ_BUFFER_SIZE: usize = 50 * 1024;

#[derive(ThisError, Debug, Clone)]
pub enum Error {
    #[error("Input file doesn't exist")]
    NoFile,
    #[error("IO error: {0}")]
    Io(String),
    #[error("Method next called multiple times")]
    MultipleChunkRequest,
    #[error("Attempt to pass chunks multiple times")]
    MultipleChunkPassed,
    #[error("Channel error: {0}")]
    Channel(String),
    #[error("API already in use")]
    AlreadyInUse,
    #[error("This source doesn't support write operations")]
    NotWritableSource,
    #[error("Fail to confirm recieving of chunk")]
    ChunkIsNotConfirmed,
    #[error("Fail to confirm a chunk")]
    FailChunkConfirmation,
    #[error("Not supported yet")]
    NotSupported,
}

impl error::Error for Error {}

#[derive(Clone, Debug)]
pub struct Options {
    pub path: PathBuf,
    pub buffer_size: usize,
}

pub struct Source {
    path: Option<PathBuf>,
    file: Option<File>,
    pos: u64,
    cancel: CancellationToken,
}

impl Source {
    pub fn new() -> Self {
        Self {
            file: None,
            path: None,
            pos: 0,
            cancel: CancellationToken::new(),
        }
    }
}

#[async_trait]
impl source::Source<Options, Error> for Source {
    async fn assign(&mut self, options: Options) -> Result<(), Error> {
        self.file = Some(File::open(&options.path).map_err(|e| Error::Io(e.to_string()))?);
        self.path = Some(options.path);
        Ok(())
    }
    async fn close(&self) -> Result<(), Error> {
        Err(Error::NotSupported)
    }

    async fn next(&mut self) -> Option<Vec<u8>> {
        if let Some(file) = self.file.as_mut() {
            if file.seek(SeekFrom::Start(self.pos)).is_err() {
                return None;
            }
            let mut buffer = [0; READ_BUFFER_SIZE];
            let buffer_len = match file.read(&mut buffer) {
                Ok(len) => len,
                Err(_) => {
                    return None;
                }
            };
            if buffer_len == 0 {
                println!(">>>>>>>>>>> READ DONE: {:?} Mb", self.pos / 1024 / 1024);
                None
            } else {
                self.pos += buffer_len as u64;
                println!(">>>>>>>>>>> READ: {:?} Mb", self.pos / 1024 / 1024);
                Some(buffer.to_vec())
            }
        } else {
            None
        }
    }

    async fn write(&self, data: &[u8]) -> Result<(), Error> {
        Err(Error::NotSupported)
    }

    fn writable(&self) -> bool {
        false
    }

    async fn get_source_file(&self) -> Result<PathBuf, Error> {
        if let Some(path) = self.path.as_ref() {
            Ok(path.clone())
        } else {
            Err(Error::NotSupported)
        }
    }
}
