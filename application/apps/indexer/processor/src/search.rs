use itertools::Itertools;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::Path;
use std::path::PathBuf;
use std::{
    fs::File,
    io::{BufWriter, Write},
};
use thiserror::Error;

#[derive(Error, Debug)]
pub enum SearchError {
    #[error("Configuration error ({0})")]
    Config(String),
    #[error("Channel-Communication error ({0})")]
    Communication(String),
    #[error("IO error while grabbing: ({0})")]
    IoOperation(#[from] std::io::Error),
    #[error("Regex-Error: ({0})")]
    Regex(#[from] grep_regex::Error),
    #[error("Input-Error: ({0})")]
    Input(String),
}

use grep_regex::RegexMatcher;
use grep_searcher::{sinks::UTF8, Searcher};

pub struct SearchHolder {
    pub file_path: PathBuf,
    pub out_file_path: PathBuf,
    search_filters: Vec<SearchFilter>,
    // pub handler: Option<EventHandler>,
    // pub shutdown_channel: Channel<()>,
    // pub event_channel: Channel<IndexingResults<()>>
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct SearchFilter {
    value: String,
    is_regex: bool,
    case_sensitive: bool,
    is_word: bool,
}

use std::borrow::Cow;

#[derive(Serialize, Deserialize, Debug)]
pub struct SearchMatch<'a> {
    #[serde(rename = "n")]
    line: u64,
    #[serde(rename = "c", borrow)]
    content: Cow<'a, str>,
}

impl SearchFilter {
    pub fn new(value: &str) -> Self {
        SearchFilter {
            value: value.to_owned(),
            is_regex: true,
            case_sensitive: false,
            is_word: false,
        }
    }

    pub fn case_sensitive(mut self, sensitive: bool) -> Self {
        self.case_sensitive = sensitive;
        self
    }

    pub fn regex(mut self, regex: bool) -> Self {
        self.is_regex = regex;
        self
    }

    pub fn word(mut self, word: bool) -> Self {
        self.is_word = word;
        self
    }
}

fn escape(value: &str) -> String {
    let mapping: HashMap<char, String> = "{}[]+$^/!.*|():?,=<>\\"
        .chars()
        .map(|c| (c, format!("\\{}", c)))
        .collect();
    value
        .chars()
        .map(|c| match mapping.get(&c) {
            Some(v) => v.clone(),
            None => format!("{}", c),
        })
        .collect::<String>()
}

fn filter_as_regex(filter: &SearchFilter) -> String {
    let word_marker = if filter.is_word { "\\b" } else { "" };
    let ignore_case_start = if filter.case_sensitive { "(?i)" } else { "" };
    let ignore_case_end = if filter.case_sensitive { "(?-i)" } else { "" };
    let subject = if filter.is_regex {
        filter.value.clone()
    } else {
        escape(&filter.value)
    };
    format!(
        "{}{}{}{}{}",
        ignore_case_start, word_marker, subject, word_marker, ignore_case_end,
    )
}

impl SearchHolder {
    pub fn new<'a, I>(path: &Path, filters: I) -> Self
    where
        I: Iterator<Item = &'a SearchFilter>,
    {
        let mut search_filters = vec![];
        for filter in filters {
            search_filters.push(filter.clone());
        }
        Self {
            file_path: PathBuf::from(path),
            out_file_path: PathBuf::from(format!("{}.out", path.to_string_lossy())),
            search_filters,
        }
    }

    pub fn execute_search(&self) -> Result<PathBuf, SearchError> {
        if self.search_filters.is_empty() {
            return Err(SearchError::Input(
                "Cannot search without filters".to_owned(),
            ));
        }
        let regex: String = format!(
            "({})",
            self.search_filters
                .iter()
                .map(|f: &SearchFilter| filter_as_regex(&f))
                .join("|")
        );
        println!(
            "Search {} in {:?}, put out to {:?}",
            regex, self.file_path, self.out_file_path
        );
        let matcher = RegexMatcher::new(&regex)?;
        let out_file = File::create(&self.out_file_path)?;
        let mut writer = BufWriter::new(out_file);
        Searcher::new().search_path(
            &matcher,
            &self.file_path,
            UTF8(|_lnum, line| {
                let line_match = SearchMatch {
                    line: _lnum,
                    content: Cow::Borrowed(line),
                };
                if let Ok(content) = serde_json::to_string(&line_match) {
                    writeln!(writer, "{}", content);
                } else {
                    log::error!("Could not serialize {:?}", line_match);
                }
                Ok(true)
            }),
        )?;

        Ok(self.out_file_path.clone())
    }
}

#[cfg(test)]
mod tests {
    const LOGS: &[&str] = &[
        "[Info](1.3): a",
        "[Warn](1.4): b",
        "[Info](1.5): c",
        "[Err](1.6): d",
        "[Info](1.7): e",
        "[Info](1.8): f",
    ];
    use super::*;
    use std::io::{Error, ErrorKind};
    fn as_matches(content: &str) -> Vec<SearchMatch> {
        let lines: Vec<&str> = content.lines().collect();
        lines
            .into_iter()
            .map(|line| serde_json::from_str(line).unwrap())
            .collect()
    }

    #[test]
    fn test_ripgrep_as_library() -> Result<(), std::io::Error> {
        let filters = vec![
            SearchFilter::new(r"[Err]")
                .regex(false)
                .case_sensitive(true)
                .word(false),
            SearchFilter::new(r"\[Warn\]")
                .regex(true)
                .case_sensitive(true)
                .word(false),
        ];
        let mut tmp_file = tempfile::NamedTempFile::new()?;
        let input_file = tmp_file.as_file_mut();
        input_file.write_all(LOGS.concat().as_bytes())?;

        let search_holder = SearchHolder::new(tmp_file.path(), filters.iter());
        let out_path = search_holder
            .execute_search()
            .map_err(|e| Error::new(ErrorKind::Other, format!("Error in search: {}", e)))?;
        let result_content = std::fs::read_to_string(out_path)?;
        let matches = as_matches(&result_content);
        println!("matches:\n{:?}", matches);
        assert_eq!(2, matches.len());
        assert_eq!(2, matches[0].line);
        assert_eq!("a", matches[0].content);
        Ok(())
    }
}
