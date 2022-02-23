use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone)]
pub struct Event {
	pub guid: String,
	pub length: u64,
	pub rowsCount: u64,
}
