mod languages;
mod ranking;
mod result;
pub mod routes;
mod torrentio;

use std::collections::HashMap;
use std::sync::{Arc, Mutex};

use watchit_core::AppResult;

pub use result::{Candidate, TorrentResult};

use crate::quality::Quality;
use crate::title_id::TitleId;
use crate::titles::Titles;

pub struct Ranked {
    pub candidates: Vec<Candidate>,
    pub hidden: usize,
}

#[derive(Clone)]
pub struct Search {
    http: reqwest::Client,
    titles: Arc<dyn Titles>,
    trackers: Arc<Mutex<HashMap<String, Vec<String>>>>,
}

impl Search {
    pub fn new(http: reqwest::Client, titles: Arc<dyn Titles>) -> Self {
        Self {
            http,
            titles,
            trackers: Arc::default(),
        }
    }

    pub async fn ranked(&self, title: &TitleId, quality: &Quality) -> AppResult<Ranked> {
        let id = title.to_string();
        let (found, runtime) = tokio::join!(torrentio::streams(&self.http, title), self.titles.runtime_minutes(&id));
        let mut found = found?;
        self.remember(&found);
        let total = found.len();
        found.retain(|candidate| quality.admits(candidate));
        let hidden = total - found.len();
        ranking::rank(&mut found, quality, runtime);
        Ok(Ranked { candidates: found, hidden })
    }

    pub async fn season_start(&self, series: &str, season: u32) -> TitleId {
        let first = self.titles.season_episodes(series, season).await.first().copied().unwrap_or(1);
        TitleId::episode(series, season, first)
    }

    pub fn trackers(&self, info_hash: &str) -> Vec<String> {
        self.trackers.lock().expect("trackers lock").get(info_hash).cloned().unwrap_or_default()
    }

    fn remember(&self, found: &[Candidate]) {
        let mut trackers = self.trackers.lock().expect("trackers lock");
        for candidate in found.iter().filter(|candidate| !candidate.trackers.is_empty()) {
            trackers.insert(candidate.result.info_hash.clone(), candidate.trackers.clone());
        }
    }
}
