use crate::traits::{error, map, map::Map, parser, parser::Parser, source, source::Source};
use bytes::BytesMut;
use std::marker::PhantomData;
use std::{fs, io, ops::Range, path::PathBuf, str::Utf8Error};
use thiserror::Error as ThisError;
use tokio::{
    fs::File,
    io::{AsyncReadExt, AsyncSeekExt, AsyncWriteExt, SeekFrom},
    join, select,
    sync::{
        mpsc::{channel, Receiver, Sender},
        oneshot,
    },
};
use tokio_util::sync::CancellationToken;
use uuid::Uuid;

#[derive(ThisError, Debug)]
pub enum Error {
    #[error("Source error: {0}")]
    SourceError(String),
    #[error("Parsing error: {0}")]
    Parsing(String),
    #[error("Converting into string error: {0}")]
    UTF8String(Utf8Error),
    #[error("Channel error: {0}")]
    Channel(String),
    #[error("Responsing error: {0}")]
    Responsing(String),
    #[error("API already in use")]
    AlreadyInUse,
    #[error("Buffer event cannot be requested frop multiple points")]
    MultipleEventRequest,
    #[error("No range found")]
    NoRange,
    #[error("No output file")]
    NoOutputFile,
    #[error("IO error: {0}")]
    Io(io::Error),
}

pub enum Next {
    Updated(usize),
    Empty,
    Close,
}

pub struct Buffer<SO, PO, SE, PE, P, S>
where
    SO: Clone,
    PO: Clone,
    SE: error::Error,
    PE: error::Error,
    P: Parser<PO, PE>,
    S: Source<SO, SE>,
{
    location: PathBuf,
    file: Option<File>,
    cancel: CancellationToken,
    parser: P,
    source: S,
    buffer: Vec<u8>,
    map: Map,
    se: Option<PhantomData<SE>>,
    pe: Option<PhantomData<PE>>,
    so: Option<PhantomData<SO>>,
    po: Option<PhantomData<PO>>,
}

impl<
        SO: Clone,
        PO: Clone,
        SE: error::Error,
        PE: error::Error,
        P: Parser<PO, PE>,
        S: Source<SO, SE>,
    > Buffer<SO, PO, SE, PE, P, S>
{
    pub async fn new(
        location: PathBuf,
        source: S,
        parser: P,
        parser_options: PO,
    ) -> Result<Self, Error> {
        let location = if parser.is_encoding_required() {
            let path = location.join(Uuid::new_v4().to_string());
            File::create(&path).await.map_err(Error::Io)?;
            path
        } else {
            source
                .get_source_file()
                .await
                .map_err(|e| Error::SourceError(e.to_string()))?
        };
        let file: Option<File> = if parser.is_encoding_required() {
            Some(File::open(&location).await.map_err(Error::Io)?)
        } else {
            None
        };
        Ok(Self {
            location,
            file,
            cancel: CancellationToken::new(),
            parser,
            source,
            buffer: vec![],
            map: Map::new(),
            se: None,
            pe: None,
            so: None,
            po: None,
        })
    }

    pub async fn next(&mut self) -> Result<Next, Error> {
        if let Some(mut chunk) = self.source.next().await {
            self.buffer.append(&mut chunk);
            let decoded = self
                .parser
                .decode(&self.buffer)
                .map_err(|e| Error::Parsing(e.to_string()))?;
            self.buffer = decoded.rest;
            if !decoded.output.is_empty() {
                let output_str = decoded.output.join("\n");
                let output_bytes = output_str.as_bytes();
                if let Some(decoded_file) = self.file.as_mut() {
                    decoded_file
                        .write_all(output_bytes)
                        .await
                        .map_err(Error::Io)?;
                }
            } else if !decoded.map.is_empty() {
                // Add map
            }
            //self.map.push(output_bytes.len(), decoded.output.len());
            Ok(Next::Updated(0))
        } else {
            Ok(Next::Close)
        }
    }
}
