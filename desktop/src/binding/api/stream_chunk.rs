use crate::binding::{context, events};
use futures::lock::Mutex;
use serde::{Deserialize, Serialize};
use session::session::{GrabbedContent, LineRange, Session};
use std::time::{Duration, Instant};
use tauri::State;
use tokio::sync::{mpsc::UnboundedSender, oneshot};

#[derive(Serialize, Deserialize)]
pub struct Request {
	guid: String,
	id: String,
	data: Option<String>,
	start: i64,
	end: i64,
	length: Option<i64>,
	rows: Option<i64>,
	error: Option<String>,
}

#[derive(Serialize, Deserialize)]
pub struct Response {
	guid: String,
	id: String,
	data: Option<String>,
	start: i64,
	end: i64,
	length: Option<i64>,
	rows: Option<i64>,
	error: Option<String>,
}

pub async fn handling(
	request: Request,
	context: State<'_, context::ContextHolder>,
) -> Result<Response, String> {
	// let now = Instant::now();
	let ctx = context.0.lock().await;
	match ctx
		.grab(LineRange::from(request.start as u64..=request.end as u64))
		.await
	{
		Ok(grabbed) => Ok(Response {
			guid: String::from("0000-0000-0000-0000-0000"),
			id: request.id,
			data: Some(
				grabbed
					.grabbed_elements
					.iter()
					.map(|item| item.content.clone())
					.collect::<Vec<String>>()
					.join("\n"),
			),
			start: request.start,
			end: request.end,
			length: Some(10360721),
			rows: Some(10360721),
			error: None,
		}),
		Err(err) => Ok(Response {
			guid: String::from("0000-0000-0000-0000-0000"),
			id: request.id,
			data: Some(String::from("")),
			start: request.start,
			end: request.end,
			length: Some(10360721),
			rows: Some(10360721),
			error: Some(err),
		}),
	}
	// let ctx = context.0.lock().await;
	// ctx.grab(
	// 	request.id.clone(),
	// 	LineRange::from(request.start as u64..=request.end as u64),
	// );
	// Ok(Response {
	// 	guid: String::from("0000-0000-0000-0000-0000"),
	// 	id: request.id,
	// 	data: Some(String::from("")),
	// 	start: request.start,
	// 	end: request.end,
	// 	length: Some(10360721),
	// 	rows: Some(10360721),
	// 	error: None,
	// })
}
