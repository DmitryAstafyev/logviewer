use crate::traits::{error, parser};
use thiserror::Error as ThisError;

#[derive(ThisError, Debug, Clone)]
pub enum Error {}

impl error::Error for Error {}

#[derive(Clone, Debug)]
pub struct Options;

pub struct Parser {}

impl Parser {
    pub fn new() -> Self {
        Parser {}
    }
}

impl parser::Parser<Error> for Parser {
    fn decode(&self, chunk: &[u8]) -> Result<parser::Decoded, Error> {
        if let Some(last) = chunk.iter().rposition(|b| *b == b'\n') {
            let breaks = bytecount::count(chunk, b'\n');
            if breaks <= 1 {
                Ok(parser::Decoded::Map(0, 0, chunk.to_vec()))
            } else {
                Ok(parser::Decoded::Map(
                    last,
                    breaks - 1,
                    chunk[last..].to_vec(),
                ))
            }
        } else {
            Ok(parser::Decoded::Map(0, 0, chunk.to_vec()))
        }
    }
    fn get_metadata() -> parser::MetaData {
        parser::MetaData {
            name: String::from("Text Logs"),
            desc: String::from("UTF8 encoded text logs"),
            file_extention: String::from("log"),
        }
    }
}
