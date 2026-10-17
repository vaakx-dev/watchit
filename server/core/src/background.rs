use std::future::Future;

use tokio_util::sync::CancellationToken;
use tokio_util::task::TaskTracker;

#[derive(Clone, Default)]
pub struct Background {
    stop: CancellationToken,
    tasks: TaskTracker,
}

impl Background {
    pub fn spawn(&self, task: impl Future<Output = ()> + Send + 'static) {
        self.tasks.spawn(task);
    }

    pub fn stopping(&self) -> impl Future<Output = ()> + Send + 'static {
        self.stop.clone().cancelled_owned()
    }

    pub fn is_stopping(&self) -> bool {
        self.stop.is_cancelled()
    }

    pub fn stop(&self) {
        self.stop.cancel();
    }

    pub async fn finished(&self) {
        self.tasks.close();
        self.tasks.wait().await;
    }
}
