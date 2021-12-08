use crate::traits::{error, holders, parser, parser::Parser, source, source::Data};
use async_trait::async_trait;
use futures_core::stream::Stream;
use std::marker::PhantomData;
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

pub struct Source<PE: error::Error, P: Parser<PE>, D: Data> {
    path: PathBuf,
    file: File,
    buffer: Vec<u8>,
    pos: u64,
    parser: Option<P>,
    pe: Option<PhantomData<PE>>,
    _d: Option<PhantomData<D>>,
}

impl<PE: error::Error, P: Parser<PE>, D: Data> Source<PE, P, D> {
    pub fn new(options: Options, parser: Option<P>) -> Result<Self, Error> {
        Ok(Self {
            file: File::open(&options.path).map_err(|e| Error::Io(e.to_string()))?,
            path: options.path,
            pos: 0,
            parser,
            buffer: vec![],
            pe: None,
            _d: None,
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
            if let Some(parser) = self.parser.as_mut() {
                let decoded = match parser.decode(&self.buffer) {
                    Ok(decoded) => decoded,
                    Err(err) => {
                        return Some(Err(Error::Parser(err.to_string())));
                    }
                };
                println!(
                    ">>>>>>>>>>> READ: {:?} Mb / {} Kb",
                    self.pos / 1024 / 1024,
                    self.buffer.len() / 1024
                );
                match decoded {
                    parser::Decoded::Rows(rows, rest) => {
                        self.buffer = rest;
                        Some(Ok((0, 0)))
                        //Some(Ok(Output::Rows(rows)))
                    }
                    parser::Decoded::Map(bytes, rows, rest) => {
                        self.buffer = rest;
                        Some(Ok((bytes, rows)))
                    }
                }
            } else if let Some(last) = self.buffer.iter().rposition(|b| *b == b'\n') {
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
impl<PE: error::Error, P: Parser<PE>, D: Data> source::Source<D, Error> for Source<PE, P, D> {
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

impl<PE: error::Error, P: Parser<PE>, D: Data> Stream for Source<PE, P, D> {
    type Item = Result<D, Error>;
    fn poll_next(
        mut self: std::pin::Pin<&mut Self>,
        _cx: &mut std::task::Context,
    ) -> core::task::Poll<Option<Self::Item>> {
        core::task::Poll::Ready(None)
    }
}
