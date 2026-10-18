use std::sync::Arc;

use tokio::sync::{Notify, OwnedSemaphorePermit, Semaphore};

const MAX_DOWNLOADS: usize = 6;
const MAX_BACKGROUND_DOWNLOADS: usize = 2;
const MAX_ENCODES: usize = 2;

pub(crate) struct Slots {
    downloads: Arc<Semaphore>,
    background: Arc<Semaphore>,
    encodes: Arc<Semaphore>,
}

pub(crate) struct Slot {
    _download: OwnedSemaphorePermit,
    _background: Option<OwnedSemaphorePermit>,
}

impl Slots {
    pub fn new() -> Self {
        Self {
            downloads: Arc::new(Semaphore::new(MAX_DOWNLOADS)),
            background: Arc::new(Semaphore::new(MAX_BACKGROUND_DOWNLOADS)),
            encodes: Arc::new(Semaphore::new(MAX_ENCODES)),
        }
    }

    pub async fn download(&self, background: bool, promoted: &Notify) -> Slot {
        let reserved = if background {
            tokio::select! {
                permit = self.background.clone().acquire_owned() => permit.ok(),
                () = promoted.notified() => None,
            }
        } else {
            None
        };
        let download = self.downloads.clone().acquire_owned().await.expect("download slots stay open");
        Slot {
            _download: download,
            _background: reserved,
        }
    }

    pub async fn encode(&self) -> OwnedSemaphorePermit {
        self.encodes.clone().acquire_owned().await.expect("encode slots stay open")
    }
}
