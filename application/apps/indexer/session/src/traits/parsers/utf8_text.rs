use crate::traits::{error, parser};
use async_trait::async_trait;
use encoding_rs_io::*;
use std::io::{BufRead, BufReader};
use thiserror::Error as ThisError;

#[derive(ThisError, Debug, Clone)]
pub enum Error {
    #[error("Dummy {0}")]
    Dummy(String),
    #[error("Converting into UTF8 string error: {0}")]
    UTF8String(String),
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
    fn decode(&self, chunk: &[u8], _opt: &Options) -> Result<parser::Decoded, Error> {
        let text = unsafe { std::str::from_utf8_unchecked(chunk) };
        let mut lines: Vec<String> = text
            .split('\n')
            .collect::<Vec<&str>>()
            .iter()
            .map(|s| s.to_string())
            .collect();
        if lines.len() <= 1 {
            Ok(parser::Decoded {
                output: vec![],
                rest: chunk.to_vec(),
            })
        } else {
            let rest = lines.remove(lines.len() - 1);
            Ok(parser::Decoded {
                output: lines,
                rest: rest.as_bytes().to_vec(),
            })
        }
    }

    fn is_encoding_required(&self) -> bool {
        false
    }
}
