use crate::binding::events::{grabbed, Event};
use futures::lock::Mutex;
use session::session::{factory, CallbackEvent, GrabbedContent, LineRange, Session, Source};
use std::sync::{Arc, RwLock};
use tokio::{
	sync::{
		mpsc::{unbounded_channel, UnboundedReceiver, UnboundedSender},
		oneshot,
	},
	task,
};
use tokio_util::sync::CancellationToken;

pub struct ContextHolder(pub Mutex<Context>);

pub enum SessionAPI {
	Grab(String, LineRange),
}
pub struct Context {
	tx_events: Option<UnboundedSender<Event>>,
	tx_session: Option<UnboundedSender<SessionAPI>>,
}

impl Context {
	pub fn new() -> Self {
		Self {
			tx_events: None,
			tx_session: None,
		}
	}
	pub fn set_events_channel(&mut self, tx_events: UnboundedSender<Event>) {
		self.tx_events = Some(tx_events);
	}
	pub fn set_session(&mut self, session: Session) {
		let (tx_session, mut rx_session): (
			UnboundedSender<SessionAPI>,
			UnboundedReceiver<SessionAPI>,
		) = unbounded_channel();
		self.tx_session = Some(tx_session);
		if let Some(tx_events) = self.tx_events.as_ref() {
			let tx_events = tx_events.clone();
			task::spawn(async move {
				while let Some(cmd) = rx_session.recv().await {
					match cmd {
						SessionAPI::Grab(request_id, range) => {
							let start = *range.range.start() as i64;
							let end = *range.range.end() as i64;
							if let Ok(grabbed) = session.grab(range).await {
								tx_events.send(Event::Grabbed(grabbed::Event {
									guid: String::from("0000-0000-0000-0000-0000"),
									id: request_id,
									data: Some(String::from(
										grabbed
											.grabbed_elements
											.iter()
											.map(|i| i.content.clone())
											.collect::<Vec<String>>()
											.join("\n"),
									)),
									start: start,
									end: end,
									length: Some(10360721),
									rows: Some(10360721),
								}));
							}
						}
					}
				}
			});
		}
	}
	pub fn emit(&self, event: Event) {
		if let Some(tx_events) = self.tx_events.as_ref() {
			tx_events.send(event);
		}
	}
	pub fn get_events_channel(&self) -> Option<UnboundedSender<Event>> {
		self.tx_events.as_ref().map(|tx_events| tx_events.clone())
	}

	pub fn grab(&self, request_id: String, range: LineRange) {
		if let Some(tx_session) = self.tx_session.as_ref() {
			tx_session.send(SessionAPI::Grab(request_id, range));
		}
	}
}
