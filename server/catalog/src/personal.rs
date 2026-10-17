use rusqlite::Connection;
use serde::Serialize;
use ts_rs::TS;
use watchit_core::AppResult;

use crate::model::{EpisodeEntry, Title};

pub const HIDE_STATUSES: [&str; 5] = ["want", "watching", "paused", "watched", "dropped"];

#[derive(Clone, Debug, Serialize, TS)]
#[ts(export_to = "catalog/")]
pub struct SeriesProgress {
    pub last: Option<EpisodeEntry>,
    pub next: Option<EpisodeEntry>,
    pub opened_at: Option<String>,
}

#[derive(Clone, Debug, Default)]
pub struct TitleExtras {
    pub playback_source: Option<String>,
    pub progress: Option<SeriesProgress>,
}

pub trait Personal: Send + Sync + 'static {
    fn hidden(&self, conn: &Connection, profile: i64, statuses: &[String]) -> AppResult<Vec<String>>;

    fn settled(&self, conn: &Connection, profile: i64) -> AppResult<Vec<String>>;

    fn title(&self, conn: &Connection, profile: i64, title: &Title) -> AppResult<TitleExtras>;
}
