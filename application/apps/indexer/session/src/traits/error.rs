use std::marker::Unpin;
pub trait Error: std::error::Error + Clone + Sync + Send + Unpin {}
