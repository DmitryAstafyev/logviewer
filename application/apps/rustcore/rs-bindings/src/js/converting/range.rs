use node_bindgen::{
    core::{
        val::{JsEnv, JsObject},
        NjError, TryIntoJs,
    },
    sys::napi_value,
};
use serde::Serialize;
use std::ops::RangeInclusive;

#[derive(Serialize, Debug, Clone)]
pub struct WrappedRangeInclusive(pub RangeInclusive<u64>);

impl TryIntoJs for WrappedRangeInclusive {
    fn try_to_js(self, js_env: &JsEnv) -> Result<napi_value, NjError> {
        let mut json = JsObject::new(*js_env, js_env.create_object()?);
        json.set_property("from", js_env.create_int32(*self.0.start() as i32)?)?;
        json.set_property("to", js_env.create_int32(*self.0.end() as i32)?)?;
        json.try_to_js(js_env)
    }
}
