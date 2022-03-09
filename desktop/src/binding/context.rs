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

pub struct Context {
	tx_events: Option<UnboundedSender<Event>>,
	session: Option<Session>,
}

impl Context {
	pub fn new() -> Self {
		Self {
			tx_events: None,
			session: None,
		}
	}
	pub fn set_events_channel(&mut self, tx_events: UnboundedSender<Event>) {
		self.tx_events = Some(tx_events);
	}
	pub fn set_session(&mut self, session: Session) {
		self.session = Some(session);
	}
	pub fn emit(&self, event: Event) {
		if let Some(tx_events) = self.tx_events.as_ref() {
			tx_events.send(event);
		}
	}
	pub fn get_events_channel(&self) -> Option<UnboundedSender<Event>> {
		self.tx_events.as_ref().map(|tx_events| tx_events.clone())
	}

	pub async fn grab(&self, range: LineRange) -> Result<GrabbedContent, String> {
		if let Some(session) = self.session.as_ref() {
			session.grab(range).await.map_err(|e| e.to_string())
		} else {
			Err(String::from("No session"))
		}
	}
}
