use crate::traits::{error, output, output::Output, parser::Data, source::Source};
use std::marker::PhantomData;
use std::path::PathBuf;
use thiserror::Error as ThisError;

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
            let map = self
                .source
                .next_map()
                .await
                .map_err(|e| Error::Source(e.to_string()))?;
            if let Some((bytes, rows)) = map {
                Ok(Next::Updated(
                    self.output.map(bytes, rows).await.map_err(Error::Output)?,
                ))
            } else {
                self.output.report();
                Ok(Next::Empty)
            }
        } else {
            let entity = self
                .source
                .next()
                .await
                .map_err(|e| Error::Source(e.to_string()))?;
            if let Some(entity) = entity {
                Ok(Next::Updated(
                    self.output.content(entity).await.map_err(Error::Output)?,
                ))
            } else {
                self.output.report();
                Ok(Next::Empty)
            }
        }
    }
}
