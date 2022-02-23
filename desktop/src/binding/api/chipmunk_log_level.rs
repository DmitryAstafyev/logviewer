use crate::binding::{context, events};
use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Serialize, Deserialize)]
pub struct Request {}

#[derive(Serialize, Deserialize)]
pub struct Response {
	level: String,
}

pub async fn handling() -> Result<Response, String> {
	Ok(Response {
		level: String::from("DEBUG"),
	})
}
