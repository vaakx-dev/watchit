use std::time::Instant;

use chrono::Local;
use watchit_core::AppResult;

use super::{SpeedStatus, store};
use crate::engine;
use crate::transfers::Transfers;

impl Transfers {
    fn reading(&self) -> bool {
        self.entries().values().any(|entry| entry.readers > 0 && !entry.progress().finished())
    }

    async fn save_alternative(&self, alternative: bool) -> AppResult<()> {
        self.db.run(move |conn| store::save(conn, alternative)).await
    }

    pub async fn steer_bandwidth(&self) {
        let steering = self.bandwidth.steer(&self.settings(), &Local::now(), Instant::now(), self.reading());
        if let Some(limits) = steering.limits {
            engine::set_limits(&self.session, limits);
        }
        if let Some(alternative) = steering.alternative
            && let Err(error) = self.save_alternative(alternative).await
        {
            tracing::warn!(%error, "could not save the alternative speed mode");
        }
        if let Some(status) = steering.status {
            self.emit_speed(status);
        }
    }

    pub async fn set_alternative(&self, alternative: bool) -> AppResult<SpeedStatus> {
        self.save_alternative(alternative).await?;
        self.bandwidth.set_alternative(alternative);
        self.steer_bandwidth().await;
        self.wake();
        Ok(self.bandwidth.status())
    }
}
