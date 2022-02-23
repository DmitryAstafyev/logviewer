use crate::binding::{context, events};
use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Serialize, Deserialize)]
pub struct Request {
	state: String,
	message: String,
}

#[derive(Serialize, Deserialize)]
pub struct Response {
	state: String,
	message: String,
}

pub async fn handling() -> Result<Response, String> {
	Ok(Response {
		state: String::from("ready"),
		message: String::from(""),
	})
}
