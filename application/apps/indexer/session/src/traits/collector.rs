use crate::traits::{
    error, output,
    output::Output,
    source::{Data, Source},
};
use std::marker::PhantomData;
use std::path::PathBuf;
use thiserror::Error as ThisError;
use tokio_stream::StreamExt;

#[derive(ThisError, Debug)]
pub enum Error {
    #[error("Output error: {0}")]
    Output(output::Error),
    #[error("Source error: {0}")]
    Source(String),
    #[error("Not supported yet")]
    NotSupported,
}

pub enum Next {
    Updated(usize),
    Empty,
}

pub struct Collector<S, E, D>
where
    E: error::Error,
    D: Data,
    S: Source<D, E>,
{
    source: S,
    output: Output,
    _e: Option<PhantomData<E>>,
    _d: Option<PhantomData<D>>,
}

impl<E: error::Error, D: Data, S: Source<D, E>> Collector<S, E, D> {
    pub async fn new(source: S) -> Result<Self, Error> {
        let path = if let Some(path) = source.get_output_file() {
            path
        } else {
            PathBuf::from("/tmp/temp_file.log")
        };
        Ok(Self {
            source,
            output: Output::new(path).await.map_err(Error::Output)?,
            _e: None,
            _d: None,
        })
    }

    pub async fn next(&mut self) -> Result<Next, Error> {
        if self.source.is_mapper() {
            if let Some(res) = self.source.next_map().await {
                let (bytes, rows) = res.map_err(|e| Error::Source(e.to_string()))?;
                Ok(Next::Updated(
                    self.output.map(bytes, rows).await.map_err(Error::Output)?,
                ))
            } else {
                Ok(Next::Empty)
            }
        } else if let Some(data) = self.source.next().await {
            match data {
                Ok(data) => Ok(Next::Updated(
                    self.output.content(data).await.map_err(Error::Output)?,
                )),
                Err(err) => Err(Error::Source(err.to_string())),
            }
        } else {
            self.output.report();
            Ok(Next::Empty)
        }
    }
}
