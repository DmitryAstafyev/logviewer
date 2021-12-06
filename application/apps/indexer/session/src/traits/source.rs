use crate::traits::error;
use async_trait::async_trait;
use std::ops::Range;
use std::path::PathBuf;

#[async_trait]
pub trait Source<O, E: error::Error> {
    /// Init transport to be used and start streaming.
    /// After init method next() has to be available
    /// Init can be called multiple times per session
    ///
    /// # Arguments
    ///
    /// * `options` - specific options for source
    /// * `parsers` - collection of parser to decode / encode content
    async fn assign(&mut self, options: O) -> Result<(), E>;

    /// Stop any reading operations.
    /// After transport is closed method `next` should returns error
    /// After transport is closed it can be opened again with `open` method
    async fn close(&self) -> Result<(), E>;

    /// Returns next chunk of data from source
    /// Returns None in case of closing source
    /// Returns None in case of source wasn't opened
    async fn next(&mut self) -> Option<(Vec<u8>)>;

    /// Attempt to write data into transport
    /// If transport doesn't support writing should return error
    /// # Arguments
    ///
    /// * `data` - a buffer to write
    async fn write(&self, data: &[u8]) -> Result<(), E>;

    /// Returns true in case of transport supports writing operations (ex: serialport, process spawing)
    fn writable(&self) -> bool;

    /// Note: Probably we want to have dynamic options for source,
    ///       which can be changes during session. That's why this
    ///       method is async
    ///
    /// Returns path to file if source of data located in a file
    async fn get_source_file(&self) -> Result<PathBuf, E>;
}
