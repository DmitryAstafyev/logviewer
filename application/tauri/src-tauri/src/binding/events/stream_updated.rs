use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone)]
pub struct Event {
	pub session: String,
	pub rows: u64,
}
