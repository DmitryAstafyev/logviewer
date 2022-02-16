use crate::binding::{context, events};
use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Serialize, Deserialize)]
pub struct Request {
	foo: String,
	bar: String,
}

#[derive(Serialize, Deserialize)]
pub struct Response {
	foo: String,
	bar: String,
}

pub async fn handling(
	_request: Request,
	context: State<'_, context::ContextHolder>,
) -> Result<Response, String> {
	println!(">>>>>>>>>>>>>>>>>>>> REQUESTED!");
	let context = context.0.read().unwrap();
	context.emit(events::Event::StreamUpdated(
		events::stream_updated::Event {
			session: String::from("test"),
			rows: 666,
		},
	));
	Ok(Response {
		foo: String::from("foo"),
		bar: String::from("bar"),
	})
}
