use super::ToBytes;
use protocol::*;
use session::state::AttachmentInfo;
use std::{mem, ops::Deref};

pub struct AttachmentInfoList(pub Vec<AttachmentInfo>);

impl Deref for AttachmentInfoList {
    type Target = Vec<AttachmentInfo>;
    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

impl ToBytes for AttachmentInfoList {
    fn into_bytes(&mut self) -> Vec<u8> {
        let els = mem::take(&mut self.0);
        let elements: Vec<attachment::AttachmentInfo> = els
            .into_iter()
            .map(|mut el| attachment::AttachmentInfo {
                uuid: el.uuid.to_string(),
                filepath: el.filepath.to_string_lossy().to_string(),
                name: mem::take(&mut el.name),
                ext: el.ext.take().unwrap_or_default(),
                size: el.size as u64,
                mime: el.mime.take().unwrap_or_default(),
                messages: el.messages.into_iter().map(|v| v as u64).collect(),
            })
            .collect();
        let list = attachment::AttachmentInfoList { elements };
        prost::Message::encode_to_vec(&list)
    }
}