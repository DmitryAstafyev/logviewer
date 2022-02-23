pub mod grabbed;
pub mod stream_updated;

use serde::{Deserialize, Serialize};
use tauri::Manager;
use tokio::{
	sync::mpsc::{unbounded_channel, UnboundedReceiver, UnboundedSender},
	task,
};

#[derive(Serialize, Deserialize, Clone)]
pub enum Event {
	StreamUpdated(stream_updated::Event),
	Grabbed(grabbed::Event),
}

pub async fn listen(app_handle: tauri::AppHandle) -> UnboundedSender<Event> {
	let (tx_events, mut rx_events): (UnboundedSender<Event>, UnboundedReceiver<Event>) =
		unbounded_channel();
	task::spawn(async move {
		println!(">>>>>>>>>>>>>>> EVENTS: started");
		while let Some(event) = rx_events.recv().await {
			println!(">>>>>>>>>>>>>>> EVENTS: get event");
			app_handle.emit_all("api-event", event).unwrap();
		}
		println!(">>>>>>>>>>>>>>> EVENTS: stopped");
	});
	tx_events
}
