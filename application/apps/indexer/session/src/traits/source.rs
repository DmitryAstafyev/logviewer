use crate::traits::error;
use async_trait::async_trait;
use futures_core::stream::Stream;
use std::path::PathBuf;

pub trait Data: Send + Sync + Unpin {
    fn as_strings(&self) -> Vec<String> {
        vec![]
    }
    fn as_bytes(&self) -> Vec<u8> {
        vec![]
    }
}

pub struct PhantomHolder {}

impl Data for PhantomHolder {}

#[async_trait]
pub trait Source<D: Data, E: error::Error>:
    Stream<Item = Result<D, E>> + Send + Sync + Unpin
{
    /// Provides safe way to shutdown/close source
    async fn close(&self) -> Result<(), E> {
        Ok(())
    }

    async fn next_map(&mut self) -> Option<Result<(usize, usize), E>> {
        None
    }

    fn is_mapper(&self) -> bool {
        false
    }
    /// Attempt to write data into transport
    /// If transport doesn't support writing should return error
    /// # Arguments
    ///
    /// * `data` - a buffer to write
    async fn write(&self, data: &[u8]) -> Result<(), E> {
        Ok(())
    }
    /// Returns true in case of transport supports writing operations (ex: serialport, process spawing)
    fn writable(&self) -> bool {
        false
    }
    /// Returns path to file if source of data located in a text file and
    /// doesn't require decode/encode operation. It means source file could be
    /// used for search and grabbing.
    /// Should return None in case of source-file cannot be used for
    /// search or/and grabbibg
    fn get_output_file(&self) -> Option<PathBuf>;
}
