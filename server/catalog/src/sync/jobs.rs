use std::collections::{HashSet, VecDeque};

use serde::{Deserialize, Serialize};

use crate::cinemeta::source::SourceQuery;
use crate::clock::{DAY_MS, iso, now_ms};
use crate::model::{CatalogKind, ImportStatus, MediaKind};

const DISCOVERY_REFRESH_MS: i64 = 7 * DAY_MS;
pub(crate) const TRENDING_REFRESH_MS: i64 = DAY_MS;

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, PartialOrd, Ord)]
pub(crate) enum Priority {
    #[default]
    Crawl,
    Backfill,
    Visible,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub(crate) enum Work {
    Catalog {
        query: SourceQuery,
        discovery: bool,
        #[serde(default)]
        previous: Vec<String>,
        #[serde(default)]
        details: VecDeque<String>,
        #[serde(default)]
        has_next: bool,
    },
    Trending {
        kind: CatalogKind,
        #[serde(default)]
        ids: Vec<String>,
    },
    Title {
        id: String,
        #[serde(default)]
        kind: Option<MediaKind>,
    },
    Episodes {
        id: String,
    },
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub(crate) struct Job {
    pub key: String,
    pub work: Work,
    pub page: u32,
    pub complete: bool,
    pub updated_at: i64,
    pub retry_at: i64,
    pub error: Option<String>,
    #[serde(skip)]
    pub priority: Priority,
}

impl Job {
    pub fn new(key: String, work: Work) -> Self {
        let mut job = Self {
            key,
            work,
            page: 1,
            complete: false,
            updated_at: 0,
            retry_at: 0,
            error: None,
            priority: Priority::Crawl,
        };
        job.priority = job.default_priority();
        job
    }

    pub fn default_priority(&self) -> Priority {
        match self.work {
            Work::Catalog { discovery: true, .. } => Priority::Crawl,
            Work::Title { .. } | Work::Episodes { .. } => Priority::Backfill,
            Work::Catalog { .. } | Work::Trending { .. } => Priority::Visible,
        }
    }

    pub fn detail(&self) -> bool {
        matches!(self.work, Work::Title { .. } | Work::Episodes { .. })
    }

    pub fn finished_detail(&self) -> bool {
        self.detail() && self.complete && self.error.is_none()
    }

    fn discovery(&self) -> bool {
        matches!(self.work, Work::Catalog { discovery: true, .. })
    }

    pub fn due(&self, now: i64, metadata_ms: i64) -> bool {
        let refresh = match self.work {
            Work::Trending { .. } => TRENDING_REFRESH_MS,
            Work::Catalog { discovery: true, .. } => DISCOVERY_REFRESH_MS.max(metadata_ms),
            _ => metadata_ms,
        };
        now - self.updated_at >= refresh
    }

    pub fn pending(&self, now: i64, metadata_ms: i64) -> bool {
        !self.complete || ((self.discovery() || matches!(self.work, Work::Trending { .. })) && self.due(now, metadata_ms))
    }
}

#[derive(Default)]
pub(crate) struct Queue {
    pub jobs: Vec<Job>,
    pub error: Option<String>,
    pub next_retry_at: Option<i64>,
    pub active: HashSet<String>,
}

impl Queue {
    pub fn paused(&self, now: i64) -> bool {
        self.next_retry_at.is_some_and(|retry_at| retry_at > now)
    }

    fn ready(&self, job: &Job, now: i64, metadata_ms: i64) -> bool {
        job.pending(now, metadata_ms)
            && !self.active.contains(&job.key)
            && job.retry_at <= now
            && (job.priority > Priority::Crawl || !self.paused(now))
    }

    pub fn next(&self, now: i64, metadata_ms: i64) -> Option<&Job> {
        let mut selected: Option<&Job> = None;
        for job in &self.jobs {
            if self.ready(job, now, metadata_ms) && selected.is_none_or(|best| job.priority > best.priority) {
                selected = Some(job);
            }
        }
        selected
    }

    pub fn wait(&self, now: i64, metadata_ms: i64) -> i64 {
        let paused = self.next_retry_at.filter(|retry_at| *retry_at > now).map(|retry_at| retry_at - now);
        let retry = self
            .jobs
            .iter()
            .filter(|job| job.pending(now, metadata_ms) && job.retry_at > now)
            .map(|job| job.retry_at - now)
            .min();
        [paused, retry].into_iter().flatten().min().unwrap_or(60_000)
    }

    pub fn insert(&mut self, job: Job) {
        let index = self.jobs.iter().position(|item| item.priority < job.priority).unwrap_or(self.jobs.len());
        self.jobs.insert(index, job);
    }

    pub fn take(&mut self, key: &str) -> Option<Job> {
        let index = self.jobs.iter().position(|job| job.key == key)?;
        Some(self.jobs.remove(index))
    }

    pub fn crawling(&self) -> bool {
        self.jobs
            .iter()
            .any(|job| job.priority == Priority::Crawl && self.active.contains(&job.key))
    }

    pub fn ensure(&mut self, job: Job, priority: Priority, metadata_ms: i64) -> Option<Job> {
        let Some(index) = self.jobs.iter().position(|item| item.key == job.key) else {
            let mut job = job;
            job.priority = priority.max(job.priority);
            self.insert(job.clone());
            return Some(job);
        };
        let existing = &mut self.jobs[index];
        let raised = priority > existing.priority;
        if raised {
            existing.priority = priority;
        }
        let refresh = existing.complete && (existing.detail() || existing.due(now_ms(), metadata_ms));
        if refresh {
            existing.complete = false;
            existing.page = 1;
            existing.retry_at = 0;
            existing.error = None;
        }
        let saved = (raised || refresh).then(|| existing.clone());
        if raised {
            let job = self.jobs.remove(index);
            self.insert(job);
        }
        saved
    }

    pub fn status(&self, key: Option<&str>, enabled: bool, imported: i64, metadata_ms: i64) -> ImportStatus {
        let now = now_ms();
        let jobs: Vec<&Job> = self.jobs.iter().filter(|job| key.is_none_or(|key| job.key == key)).collect();
        let blocked = self.paused(now) && (key.is_none() || jobs.iter().any(|job| job.priority == Priority::Crawl));
        let error = jobs
            .iter()
            .find_map(|job| job.error.clone())
            .or_else(|| if key.is_none() || blocked { self.error.clone() } else { None });
        let retry_at = jobs.iter().map(|job| job.retry_at).filter(|retry_at| *retry_at > now).min().unwrap_or(0);
        let next_retry_at = retry_at.max(if blocked { self.next_retry_at.unwrap_or(0) } else { 0 });
        let running = match key {
            Some(key) => self.active.contains(key),
            None => !self.active.is_empty(),
        };
        ImportStatus {
            enabled,
            pending: enabled && jobs.iter().any(|job| job.pending(now, metadata_ms)),
            running: enabled && running,
            imported,
            error,
            next_retry_at: (next_retry_at > now).then(|| iso(next_retry_at)),
        }
    }

    pub fn group_status(&self, keys: &[String], enabled: bool, imported: i64, metadata_ms: i64) -> ImportStatus {
        let now = now_ms();
        let jobs: Vec<&Job> = self.jobs.iter().filter(|job| keys.contains(&job.key)).collect();
        ImportStatus {
            pending: enabled && jobs.iter().any(|job| job.pending(now, metadata_ms)),
            running: enabled && jobs.iter().any(|job| self.active.contains(&job.key)),
            ..self.status(None, enabled, imported, metadata_ms)
        }
    }
}
