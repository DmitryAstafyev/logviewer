use crate::binding::{context, events};
use serde::{Deserialize, Serialize};
use session::session::{factory, CallbackEvent, GrabbedContent, LineRange, Session, Source};
use std::{env, path::PathBuf};
use tauri::State;
use tokio::{
	select,
	sync::{
		mpsc::{unbounded_channel, UnboundedReceiver, UnboundedSender},
		oneshot,
	},
	task,
};
use uuid::Uuid;

#[derive(Serialize, Deserialize)]
pub struct Request {
	guid: String,
}

#[derive(Serialize, Deserialize)]
pub struct Response {
	guid: String,
}

pub enum Merged {
	Grabbing((LineRange, oneshot::Sender<Result<GrabbedContent, String>>)),
	CB(CallbackEvent),
}

pub async fn handling(context: State<'_, context::ContextHolder>) -> Result<Response, String> {
	let mut ctx = context.0.lock().await;
	let (session, mut rx_session_events) = Session::new(Uuid::new_v4()).await;
	let args: Vec<String> = env::args().collect();
	println!("{:?}", args);
	if let Err(err) = session.observe(
		Uuid::new_v4(),
		Source::File(
			PathBuf::from(args[args.len() - 1].clone()),
			factory::ParserType::Text,
		),
	) {
		eprintln!("Fail to observe file: {}", err);
	}
	ctx.set_session(session);
	let tx_events = ctx.get_events_channel();
	drop(ctx);
	if let Some(tx_events) = tx_events {
		task::spawn(async move {
			println!(">>>>>>>>>>>>>> OBSERVE IS STARTED");
			while let Some(event) = rx_session_events.recv().await {
				println!(">>>>>>>>>>>>>> OBSERVE event: {:?}", event);
				match event {
					CallbackEvent::StreamUpdated(rows) => {
						println!(">>>>>>>>>>>>>> OBSERVE StreamUpdated: {}", rows);
						tx_events.send(events::Event::StreamUpdated(
							events::stream_updated::Event {
								guid: String::from("0000-0000-0000-0000-0000"),
								length: rows,
								rowsCount: rows,
							},
						));
					}
					_ => {}
				};
			}
			println!(">>>>>>>>>>>>>> EXIT SESSION LOOP");
		});
	} else {
		println!(">>>>>>>>>>>>>> OBSERVE no events channel");
	}
	Ok(Response {
		guid: String::from("0000-0000-0000-0000-0000"),
	})
}
