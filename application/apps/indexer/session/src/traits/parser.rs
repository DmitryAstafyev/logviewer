use crate::traits;
use async_trait::async_trait;
use std::ops::Range;

pub struct Slot {
    pub row: usize,
    pub position: Range<usize>,
}

pub struct Decoded {
    pub output: Vec<String>,
    pub map: Vec<Slot>,
    pub rest: Vec<u8>,
}

impl Decoded {
    pub fn new() -> Self {
        Self {
            output: vec![],
            map: vec![],
            rest: vec![],
        }
    }
}

#[async_trait]
pub trait Parser<PO, E: traits::error::Error> {
    /// Takes chunk of data and try to decode it.traits
    /// Returns decoded part and rest part as Decoded struct
    fn decode(&self, chunk: &[u8], opt: &PO) -> Result<Decoded, E>;

    /// Returns true if source file has encoded data; and false if source file/stream
    /// is a text file/stream
    fn is_encoding_required(&self) -> bool;
}
