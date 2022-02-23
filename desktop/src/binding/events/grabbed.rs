use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone)]
pub struct Event {
	pub guid: String,
	pub id: String,
	pub data: Option<String>,
	pub start: i64,
	pub end: i64,
	pub length: Option<i64>,
	pub rows: Option<i64>,
}
