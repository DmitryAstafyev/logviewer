use node_bindgen::{
    core::{val::JsEnv, NjError, TryIntoJs},
    sys::napi_value,
};
use unbound::OperationError;

pub(crate) struct OperationErrorWrapper(pub OperationError);

impl TryIntoJs for OperationErrorWrapper {
    fn try_to_js(self, js_env: &JsEnv) -> Result<napi_value, NjError> {
        let value = serde_json::to_value(self.0).map_err(|e| NjError::Other(format!("{e}")))?;
        value.try_to_js(js_env)
    }
}

impl From<OperationError> for OperationErrorWrapper {
    fn from(err: OperationError) -> OperationErrorWrapper {
        OperationErrorWrapper(err)
    }
}
