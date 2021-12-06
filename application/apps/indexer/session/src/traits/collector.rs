use crate::traits::{
    buffer, buffer::Buffer, error, parser, parser::Parser, source, source::Source,
};
use std::marker::PhantomData;
use std::{ops::Range, path::PathBuf};
use thiserror::Error as ThisError;
use tokio::{
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
    #[error("Buffer error: {0}")]
    Buffer(buffer::Error),
    #[error("Source error: {0}")]
    Source(String),
    #[error("Not supported yet")]
    NotSupported,
}

pub enum Next {
    Updated(usize),
}

pub struct Collector<SO, PO, SE, PE, P, S>
where
    SO: Clone,
    PO: Clone,
    SE: error::Error,
    PE: error::Error,
    P: Parser<PO, PE>,
    S: Source<SO, SE>,
{
    buffer: Buffer<SO, PO, SE, PE, P, S>,
    cancel: CancellationToken,
    source_options: SO,
    parser_options: PO,
    se: Option<PhantomData<SE>>,
    pe: Option<PhantomData<PE>>,
}

impl<
        SO: Clone,
        PO: Clone,
        SE: error::Error,
        PE: error::Error,
        P: Parser<PO, PE>,
        S: Source<SO, SE>,
    > Collector<SO, PO, SE, PE, P, S>
{
    pub async fn new(
        location: PathBuf,
        mut source: S,
        source_options: SO,
        parser: P,
        parser_options: PO,
    ) -> Result<Self, Error> {
        source
            .assign(source_options.clone())
            .await
            .map_err(|e| Error::Source(e.to_string()))?;
        let buffer = Buffer::new(location, source, parser, parser_options.clone())
            .await
            .map_err(Error::Buffer)?;
        Ok(Self {
            buffer,
            source_options,
            parser_options,
            cancel: CancellationToken::new(),
            se: None,
            pe: None,
        })
    }

    pub async fn next(&mut self) -> Result<Next, Error> {
        let event = self.buffer.next().await.map_err(Error::Buffer)?;
        match event {
            buffer::Next::Updated(rows) => Ok(Next::Updated(rows)),
            _ => Err(Error::NotSupported),
        }
    }
}
