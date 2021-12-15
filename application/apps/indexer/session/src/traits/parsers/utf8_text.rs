use crate::traits::{error, parser};
use thiserror::Error as ThisError;

pub struct Utf8Entity {
    lines: Vec<String>,
    rest: Vec<u8>,
}

impl parser::Data for Utf8Entity {
    fn as_strings(&self) -> Vec<String> {
        self.lines.clone()
    }
}

#[derive(ThisError, Debug, Clone)]
pub enum Error {}

impl error::Error for Error {}

#[derive(Clone, Debug)]
pub struct Input {
    pub timestamp: u64,
}

impl parser::Input for Input {}

pub struct Parser {}

impl Parser {
    pub fn new() -> Self {
        Parser {}
    }
}

impl parser::Parser<Error, Input, Utf8Entity> for Parser {
    fn decode(&self, chunk: &[u8], _inputs: Option<Input>) -> Result<Option<Utf8Entity>, Error> {
        let mut entity = Utf8Entity {
            lines: vec![],
            rest: vec![],
        };
        let str = unsafe { std::str::from_utf8_unchecked(&chunk) };
        let mut rows: Vec<&str> = str.split('\n').collect();
        if rows.len() == 1 {
            entity.rest = chunk.to_vec();
        } else {
            let last = rows.remove(rows.len() - 1);
            entity.rest = last.as_bytes().to_vec();
            entity.lines = rows.iter().map(|r| r.to_string()).collect();
        }
        Ok(Some(entity))
    }
    fn get_metadata() -> parser::MetaData {
        parser::MetaData {
            name: String::from("Text Logs"),
            desc: String::from("UTF8 encoded text logs"),
            file_extention: String::from("log"),
        }
    }
}
