use node_bindgen::{
    core::{
        val::{JsEnv, JsObject},
        JSValue, NjError,
    },
    sys::napi_value,
};
use serde::Serialize;
use sources::sde::SdeRequest;

#[derive(Serialize, Debug, Clone)]
pub struct WrappedSdeRequest(SdeRequest);

impl WrappedSdeRequest {
    pub fn as_sde_request(&self) -> SdeRequest {
        self.0.clone()
    }
}

impl JSValue<'_> for WrappedSdeRequest {
    fn convert_to_rust(env: &JsEnv, n_value: napi_value) -> Result<Self, NjError> {
        if let Ok(js_obj) = env.convert_to_rust::<JsObject>(n_value) {
            match js_obj.get_property("WriteText") {
                Ok(Some(value)) => {
                    return Ok(WrappedSdeRequest(SdeRequest::WriteText(value.as_value()?)))
                }
                Ok(None) => {}
                Err(e) => {
                    return Err(e);
                }
            };
            match js_obj.get_property("WriteBytes") {
                Ok(Some(value)) => {
                    let bytes: Vec<i32> = value.as_value()?;
                    return Ok(WrappedSdeRequest(SdeRequest::WriteBytes(
                        bytes.into_iter().map(|v| v as u8).collect(),
                    )));
                }
                Ok(None) => {}
                Err(e) => {
                    return Err(e);
                }
            };
        }
        Err(NjError::Other("not valid format".to_owned()))
    }
}
