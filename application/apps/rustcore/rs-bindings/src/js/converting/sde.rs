use super::{error::E, JsIncomeI32Vec};
use prost::Message;
use protocol::*;
use sources::sde::{SdeRequest, SdeResponse};
use std::{convert::TryInto, ops::Deref};
pub struct SdeResponseWrapped(pub SdeResponse);

impl Deref for SdeResponseWrapped {
    type Target = SdeResponse;
    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

impl From<SdeResponseWrapped> for Vec<u8> {
    fn from(val: SdeResponseWrapped) -> Self {
        let msg = sde::SdeResponse {
            bytes: val.bytes as u64,
        };
        prost::Message::encode_to_vec(&msg)
    }
}

impl TryInto<SdeRequest> for JsIncomeI32Vec {
    type Error = E;
    fn try_into(self) -> Result<SdeRequest, E> {
        let bytes = self.iter().map(|b| *b as u8).collect::<Vec<u8>>();
        let decoded = sde::SdeRequest::decode(&*bytes)?
            .request
            .ok_or(E::MissedField(String::from("value of SdeRequest")))?;
        Ok(match decoded {
            sde::sde_request::Request::WriteBytes(v) => SdeRequest::WriteBytes(v),
            sde::sde_request::Request::WriteText(v) => SdeRequest::WriteText(v),
        })
    }
}
