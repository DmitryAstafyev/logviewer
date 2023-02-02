use tokio_util::sync::CancellationToken;

#[derive(Debug, Clone)]
pub struct Signal {
    pub signal: CancellationToken,
    pub confirmation: CancellationToken,
}

impl Signal {
    pub fn new() -> Signal {
        Signal {
            signal: CancellationToken::new(),
            confirmation: CancellationToken::new(),
        }
    }

    pub async fn abort(&self) {
        if self.confirmation.is_cancelled() {
            return;
        }
        if !self.signal.is_cancelled() {
            self.signal.cancel();
        }
        self.confirmation.cancelled().await
    }

    pub fn confirm(&self) {
        if self.confirmation.is_cancelled() {
            return;
        }
        self.confirmation.cancel();
    }
}
