pub mod routes;
mod store;

use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use ts_rs::TS;
use watchit_core::{AppError, AppResult};

pub use store::{create_table, load, save};

use crate::bandwidth::{Schedule, WhileWatching};

const DEFAULT_SEED_RATIO: f64 = 1.0;
const DEFAULT_MAX_ACTIVE: u32 = 3;
const DEFAULT_ALT_DOWNLOAD_BPS: u32 = 1024 * 1024;
const DEFAULT_ALT_UPLOAD_BPS: u32 = 256 * 1024;
const DEFAULT_WHILE_WATCHING_BPS: u32 = 1024 * 1024;

#[derive(Clone, Debug, Serialize, Deserialize, TS)]
#[serde(deny_unknown_fields)]
#[ts(export_to = "torrents/", rename = "TorrentSettings")]
pub struct Settings {
    #[ts(type = "string")]
    pub download_dir: PathBuf,
    pub disk_budget_bytes: Option<u64>,
    pub max_download_bps: Option<u32>,
    pub max_upload_bps: Option<u32>,
    pub seed_ratio: Option<f64>,
    pub seed_minutes: Option<u32>,
    pub max_active: u32,
    pub alt_download_bps: Option<u32>,
    pub alt_upload_bps: Option<u32>,
    pub schedule: Schedule,
    pub while_watching: WhileWatching,
    pub while_watching_bps: Option<u32>,
}

impl Settings {
    pub fn defaults(download_dir: PathBuf) -> Self {
        Self {
            download_dir,
            disk_budget_bytes: None,
            max_download_bps: None,
            max_upload_bps: None,
            seed_ratio: Some(DEFAULT_SEED_RATIO),
            seed_minutes: None,
            max_active: DEFAULT_MAX_ACTIVE,
            alt_download_bps: Some(DEFAULT_ALT_DOWNLOAD_BPS),
            alt_upload_bps: Some(DEFAULT_ALT_UPLOAD_BPS),
            schedule: Schedule::defaults(),
            while_watching: WhileWatching::Pause,
            while_watching_bps: Some(DEFAULT_WHILE_WATCHING_BPS),
        }
    }

    pub fn validated(mut self) -> AppResult<Self> {
        if !self.download_dir.is_absolute() {
            return Err(AppError::bad_request("The download folder must be an absolute path."));
        }
        if self.max_active == 0 {
            return Err(AppError::bad_request("At least one download must be allowed to run."));
        }
        let rates = [self.max_download_bps, self.max_upload_bps, self.alt_download_bps, self.alt_upload_bps, self.while_watching_bps];
        if rates.contains(&Some(0)) {
            return Err(AppError::bad_request("Rate limits must be above zero, or empty for no limit."));
        }
        if self.while_watching == WhileWatching::Throttle && self.while_watching_bps.is_none() {
            return Err(AppError::bad_request("Set the speed background downloads may use while you watch."));
        }
        self.schedule = self.schedule.validated()?;
        if self.seed_ratio.is_some_and(|ratio| !ratio.is_finite() || ratio < 0.0) {
            return Err(AppError::bad_request("The seeding ratio must be zero or more."));
        }
        std::fs::create_dir_all(&self.download_dir)
            .map_err(|error| AppError::bad_request(format!("The download folder can't be used: {error}.")))?;
        Ok(self)
    }

    pub fn download_dir(&self) -> &Path {
        &self.download_dir
    }

    pub fn seeding_done(&self, ratio: f64, seeded_minutes: u64) -> bool {
        let ratio_reached = self.seed_ratio.is_some_and(|limit| ratio >= limit);
        let time_reached = self.seed_minutes.is_some_and(|limit| seeded_minutes >= u64::from(limit));
        ratio_reached || time_reached
    }
}
