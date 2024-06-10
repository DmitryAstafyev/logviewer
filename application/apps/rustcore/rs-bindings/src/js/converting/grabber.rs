use node_bindgen::{
    core::{
        val::{JsEnv, JsObject},
        NjError, TryIntoJs,
    },
    sys::napi_value,
};
use serde::Serialize;
use session::state::GrabbedElement;

#[derive(Serialize, Debug, Clone)]
pub struct WrappedGrabbedElement(pub GrabbedElement);

impl TryIntoJs for WrappedGrabbedElement {
    fn try_to_js(self, js_env: &JsEnv) -> Result<napi_value, NjError> {
        let mut obj = JsObject::new(*js_env, js_env.create_object()?);
        obj.set_property("source_id", js_env.create_int32(self.0.source_id as i32)?)?;
        obj.set_property("content", js_env.create_string_utf8(&self.0.content)?)?;
        obj.set_property("position", js_env.create_int32(self.0.pos as i32)?)?;
        obj.set_property("nature", js_env.create_int32(self.0.nature as i32)?)?;
        obj.try_to_js(js_env)
    }
}
