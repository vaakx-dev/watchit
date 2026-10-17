mod languages;
mod ranking;
mod result;
pub mod routes;
mod torrentio;

use std::collections::HashMap;
use std::sync::{Arc, Mutex};

use watchit_core::AppResult;

pub use result::{Candidate, TorrentResult};

use crate::title_id::TitleId;
use crate::titles::Titles;

#[derive(Clone)]
pub struct Search {
    http: reqwest::Client,
    titles: Arc<dyn Titles>,
    trackers: Arc<Mutex<HashMap<String, Vec<String>>>>,
}

impl Search {
    pub fn new(http: reqwest::Client, titles: Arc<dyn Titles>) -> Self {
        Self { http, titles, trackers: Arc::default() }
    }

    pub async fn ranked(&self, title: &TitleId) -> AppResult<Vec<Candidate>> {
        let id = title.to_string();
        let (found, runtime) = tokio::join!(torrentio::streams(&self.http, title), self.titles.runtime_minutes(&id));
        let mut found = found?;
        self.remember(&found);
        ranking::rank(&mut found, runtime);
        Ok(found)
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
