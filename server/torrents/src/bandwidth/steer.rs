use std::collections::HashMap;
use std::time::Instant;

use chrono::Local;
use watchit_core::AppResult;

use super::{Observation, SpeedStatus, store};
use crate::engine;
use crate::transfers::Transfers;

impl Transfers {
    fn observe(&self) -> Observation {
        let mut reading = false;
        let mut background = HashMap::new();
        for entry in self.entries().values() {
            let progress = entry.progress();
            if progress.finished() {
                continue;
            }
            if entry.readers > 0 {
                reading = true;
            } else {
                background.insert(entry.record.info_hash.clone(), progress.downloaded_bytes);
            }
        }
        Observation { reading, background }
    }

    async fn save_alternative(&self, alternative: bool) -> AppResult<()> {
        self.db.run(move |conn| store::save(conn, alternative)).await
    }

    pub async fn steer_bandwidth(&self) {
        let steering = self.bandwidth.steer(&self.settings(), &Local::now(), Instant::now(), self.observe());
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
