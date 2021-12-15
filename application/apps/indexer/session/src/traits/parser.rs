use crate::traits;
use std::marker::Unpin;
use thiserror::Error as ThisError;

pub trait Data: Send + Sync + Unpin {
    fn as_strings(&self) -> Vec<String> {
        vec![]
    }
    fn as_bytes(&self) -> Vec<u8> {
        vec![]
    }
    fn get_rest(&self) -> Vec<u8> {
        vec![]
    }
}

pub struct PhantomData {}

impl Data for PhantomData {}

#[derive(ThisError, Debug, Clone)]
pub enum PhantomError {
    #[error("Dummy")]
    Dummy,
}

impl traits::error::Error for PhantomError {}

pub struct PhantomInput {}

impl Input for PhantomInput {}

pub struct PhantomParser {}

impl Parser<PhantomError, PhantomInput, PhantomData> for PhantomParser {}

pub struct MetaData {
    pub name: String,
    pub desc: String,
    pub file_extention: String,
}

pub trait Input: Sync + Send + Unpin {}

pub trait Parser<E: traits::error::Error, I: Input, D: Data>: Sync + Send + Unpin {
    /// Takes chunk of data and try to decode it.traits
    /// Returns decoded part and rest part as Decoded struct
    fn decode(&self, _chunk: &[u8], _input: Option<I>) -> Result<Option<D>, E> {
        Ok(None)
    }

    /// Takes chunk of data and try to encode it
    /// Gives back bytes ready to be written and bytes, which weren't
    /// used
    /// (bytes_to_write, unused_bytes)
    /// (Vec<u8>,        Vec<u8>     )
    fn encode(&self, _chunk: &[u8], _input: Option<I>) -> Result<(Vec<u8>, Vec<u8>), E> {
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
