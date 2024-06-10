use node_bindgen::{
    core::{
        val::{JsEnv, JsObject},
        NjError, TryIntoJs,
    },
    sys::napi_value,
};
use serde::Serialize;
use session::state::AttachmentInfo;

#[derive(Serialize, Debug, Clone)]
pub struct WrappedAttachmentInfo(pub AttachmentInfo);

impl TryIntoJs for WrappedAttachmentInfo {
    fn try_to_js(self, js_env: &JsEnv) -> Result<napi_value, NjError> {
        let mut obj = JsObject::new(*js_env, js_env.create_object()?);
        obj.set_property("uuid", js_env.create_string_utf8(&self.0.uuid.to_string())?)?;
        obj.set_property(
            "filepath",
            js_env.create_string_utf8(self.0.filepath.to_string_lossy().as_ref())?,
        )?;
        obj.set_property("name", js_env.create_string_utf8(&self.0.name)?)?;
        obj.set_property("size", js_env.create_int32(self.0.size as i32)?)?;
        if let Some(ext) = self.0.ext {
            obj.set_property("ext", js_env.create_string_utf8(&ext)?)?;
        }
        if let Some(mime) = self.0.mime {
            obj.set_property("mime", js_env.create_string_utf8(&mime)?)?;
        }
        let js_messages = js_env.create_array_with_len(self.0.messages.len())?;
        for (i, &message) in self.0.messages.iter().enumerate() {
            let js_message = js_env.create_int32(message as i32)?;
            js_env.set_element(js_messages, js_message, i)?;
        }
        obj.set_property("messages", js_messages)?;
        obj.try_to_js(js_env)
    }
}
