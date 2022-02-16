use crate::binding::{context, events};
use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Serialize, Deserialize)]
pub struct Request {}

#[derive(Serialize, Deserialize)]
pub struct Response {
	error: Option<String>,
}

pub async fn handling(
	app_handle: tauri::AppHandle,
	context: State<'_, context::ContextHolder>,
) -> Result<Response, String> {
	let tx_events = events::listen(app_handle).await;
	match context.0.write() {
		Ok(mut context) => {
			context.set_events_channel(tx_events);
		}
		Err(_err) => {}
	};
	//
	Ok(Response { error: None })
}
