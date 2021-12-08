use crate::traits;
use async_trait::async_trait;
use std::marker::Unpin;
use thiserror::Error as ThisError;

#[derive(ThisError, Debug, Clone)]
pub enum PhantomError {
    #[error("Dummy")]
    Dummy,
}

impl traits::error::Error for PhantomError {}

pub struct PhantomParser {}

impl Parser<PhantomError> for PhantomParser {}

pub enum Decoded {
    Rows(Vec<String>, Vec<u8>),
    Map(usize, usize, Vec<u8>),
}

pub struct MetaData {
    pub name: String,
    pub desc: String,
    pub file_extention: String,
}

pub trait Parser<E: traits::error::Error>: Sync + Send + Unpin {
    /// Takes chunk of data and try to decode it.traits
    /// Returns decoded part and rest part as Decoded struct
    fn decode(&self, _chunk: &[u8]) -> Result<Decoded, E> {
        Ok(Decoded::Rows(vec![], vec![]))
    }

    /// Takes chunk of data and try to encode it
    /// Gives back bytes ready to be written and bytes, which weren't
    /// used
    /// (bytes_to_write, unused_bytes)
    /// (Vec<u8>,        Vec<u8>     )
    fn encode(&self, _chunk: &[u8]) -> Result<(Vec<u8>, Vec<u8>), E> {
        Ok((vec![], vec![]))
    }
    fn get_metadata() -> MetaData {
        MetaData {
            name: String::from("PhantomParser"),
            desc: String::from("PhantomParser"),
            file_extention: String::from("PhantomParser"),
        }
    }
}
