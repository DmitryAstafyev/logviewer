#![cfg_attr(
	all(not(debug_assertions), target_os = "windows"),
	windows_subsystem = "windows"
)]

use std::sync::{Arc, RwLock};
use tauri::Manager;
mod binding;
use futures::lock::Mutex;

fn main() {
	let context = Mutex::new(binding::context::Context::new());
	tauri::Builder::default()
		.manage(binding::context::ContextHolder(context))
		.setup(|app| {
			if let Some(win_ref) = app.get_window("main") {
				#[cfg(debug_assertions)]
				win_ref.open_devtools();
			} else {
				// Report error
			}
			Ok(())
		})
		.invoke_handler(tauri::generate_handler![binding::api::api])
		.run(tauri::generate_context!())
		.expect("error while running tauri application");
}
