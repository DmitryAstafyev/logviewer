use crate::binding::context;
use serde::{Deserialize, Serialize};
use tauri::State;

pub mod init;
pub mod open_file_dialog;

#[derive(Serialize, Deserialize)]
pub enum Request {
	Init(init::Request),
	OpenFileDialog(open_file_dialog::Request),
}

#[derive(Serialize, Deserialize)]
pub enum Response {
	Init(init::Response),
	OpenFileDialog(open_file_dialog::Response),
}

#[tauri::command]
pub async fn api(
	window: tauri::Window,
	app_handle: tauri::AppHandle,
	context: State<'_, context::ContextHolder>,
	request: Request,
) -> Result<Response, String> {
	println!(">>>>>>>>>>>>>>>>>>>> API CMD REQUESTED!");
	match request {
		Request::Init(request) => Ok(Response::Init(init::handling(app_handle, context).await?)),
		Request::OpenFileDialog(request) => Ok(Response::OpenFileDialog(
			open_file_dialog::handling(request, context).await?,
		)),
	}
}
