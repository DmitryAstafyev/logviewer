use crate::traits::{error, parser};
use async_trait::async_trait;
use encoding_rs_io::*;
use std::{
    io::{BufRead, BufReader, Read, Write},
    ops::Range,
};
use thiserror::Error as ThisError;

#[derive(ThisError, Debug, Clone)]
pub enum Error {
    #[error("Dummy {0}")]
    Dummy(String),
    #[error("Converting into UTF8 string error: {0}")]
    UTF8String(String),
    #[error("Buffer IO error: {0}")]
    BufferIO(String),
}

impl error::Error for Error {}

#[derive(Clone, Debug)]
pub struct Options;

pub struct Parser {}

impl Parser {
    pub fn new() -> Self {
        Parser {}
    }
}

#[async_trait]
impl parser::Parser<Options, Error> for Parser {
    fn decode(&self, chunk: &[u8]) -> Result<parser::Decoded, Error> {
        let mut result = parser::Decoded::new();
        if let Some(last) = chunk.iter().rposition(|b| *b == b'\n') {
            let breaks = bytecount::count(chunk, b'\n');
            result.map.push(parser::Slot {
                row: breaks - 1,
                position: Range {
                    start: 0,
                    end: chunk.len() - last,
                },
            });
            result.rest = chunk[last..].to_vec();
        } else {
            result.rest = chunk.to_vec();
        }
        Ok(result)
    }

    // fn decode(&self, chunk: &[u8]) -> Result<parser::Decoded, Error> {
    //     let buffer = DecodeReaderBytesBuilder::new()
    //         .utf8_passthru(true)
    //         .strip_bom(true)
    //         .bom_override(true)
    //         .bom_sniffing(true)
    //         .build(chunk);
    //     let mut reader = BufReader::new(buffer);
    //     let mut result = parser::Decoded::new();
    //     let mut buf = vec![];
    //     let mut cursor: usize = 0;
    //     while let Ok(len) = reader.read_until(b'\n', &mut buf) {
    //         if len == 0 {
    //             break;
    //         }
    //         let row = unsafe { std::str::from_utf8_unchecked(&buf) };
    //         result.output.push(row.to_string());
    //         result.map.push(parser::Slot {
    //             row: result.output.len() - 1,
    //             position: Range {
    //                 start: cursor,
    //                 end: cursor + len,
    //             },
    //         });
    //         cursor += len;
    //         buf = vec![];
    //     }
    //     Ok(result)
    // }

    fn is_encoding_required(&self) -> bool {
        false
    }
}
