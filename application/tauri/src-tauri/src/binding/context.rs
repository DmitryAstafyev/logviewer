use crate::binding::events::Event;
use std::sync::{Arc, RwLock};
use tokio::sync::mpsc::UnboundedSender;
use tokio_util::sync::CancellationToken;

pub struct ContextHolder(pub Arc<RwLock<Context>>);
pub struct Tokens {
	events: CancellationToken,
}

pub struct Context {
	tx_events: Option<UnboundedSender<Event>>,
	tokens: Tokens,
}

impl Context {
	pub fn new() -> Self {
		Self {
			tx_events: None,
			tokens: Tokens {
				events: CancellationToken::new(),
			},
		}
	}
	pub fn set_events_channel(&mut self, tx_events: UnboundedSender<Event>) {
		self.tx_events = Some(tx_events);
	}
	pub fn emit(&self, event: Event) {
		if let Some(tx_events) = self.tx_events.as_ref() {
			tx_events.send(event);
		}
	}
}
