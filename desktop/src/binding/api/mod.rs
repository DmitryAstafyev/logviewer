use crate::binding::context;
use serde::{Deserialize, Serialize};
use tauri::State;

pub mod chipmunk_log_level;
pub mod host_state;
pub mod init;
pub mod open_file_dialog;
pub mod stream_add_request;
pub mod stream_chunk;

#[derive(Serialize, Deserialize)]
pub enum Request {
	Init(init::Request),
	ChipmunkLogLevelRequest(chipmunk_log_level::Request),
	HostState(host_state::Request),
	OpenFileDialog(open_file_dialog::Request),
	StreamAddRequest(stream_add_request::Request),
	StreamChunk(stream_chunk::Request),
}

#[derive(Serialize, Deserialize)]
pub enum Response {
	Init(init::Response),
	HostState(host_state::Response),
	ChipmunkLogLevelResponse(chipmunk_log_level::Response),
	OpenFileDialog(open_file_dialog::Response),
	StreamAddResponse(stream_add_request::Response),
	StreamChunk(stream_chunk::Response),
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
		Request::Init(_request) => Ok(Response::Init(init::handling(app_handle, context).await?)),
		Request::ChipmunkLogLevelRequest(_request) => Ok(Response::ChipmunkLogLevelResponse(
			chipmunk_log_level::handling().await?,
		)),
		Request::HostState(_request) => Ok(Response::HostState(host_state::handling().await?)),
		Request::OpenFileDialog(request) => Ok(Response::OpenFileDialog(
			open_file_dialog::handling(request, context).await?,
		)),
		Request::StreamAddRequest(_request) => Ok(Response::StreamAddResponse(
			stream_add_request::handling(context).await?,
		)),
		Request::StreamChunk(request) => Ok(Response::StreamChunk(
			stream_chunk::handling(request, context).await?,
		)),
	}
}
