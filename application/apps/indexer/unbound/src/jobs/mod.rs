use tokio::sync::oneshot;

pub mod some;

pub enum Job {
    SomeJob((oneshot::Sender<Result<u64, String>>, u64)),
}
