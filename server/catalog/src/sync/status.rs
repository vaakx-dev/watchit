use std::sync::atomic::Ordering;

use rusqlite::Connection;
use watchit_core::AppResult;

use crate::cinemeta::source::SourceQuery;
use crate::model::{CatalogKind, ImportStatus, MediaKind};
use crate::store::browse::BrowseQuery;
use crate::store::record::{detail_fresh, kind_of};
use crate::sync::jobs::{Job, Priority, Work};
use crate::sync::{Sync, save_job};

impl Sync {
    fn imported(&self) -> i64 {
        self.inner.imported.load(Ordering::Relaxed)
    }

    fn ensure(&self, conn: &Connection, job: Job, priority: Priority) -> AppResult<()> {
        if !self.inner.enabled {
            return Ok(());
        }
        let changed = self.inner.queue.lock().unwrap().ensure(job, priority, self.inner.metadata.ms());
        if let Some(job) = changed {
            save_job(conn, &job)?;
        }
        self.inner.wake.notify_one();
        Ok(())
    }

    fn key_status(&self, key: Option<&str>) -> ImportStatus {
        self.inner
            .queue
            .lock()
            .unwrap()
            .status(key, self.inner.enabled, self.imported(), self.inner.metadata.ms())
    }

    fn browse_status(&self, empty: bool, key: Option<&str>) -> ImportStatus {
        let status = self.key_status(key);
        ImportStatus {
            pending: empty && status.pending,
            ..status
        }
    }

    pub fn status(&self) -> ImportStatus {
        self.key_status(None)
    }

    pub fn discovery_job(kind: CatalogKind) -> Job {
        let query = SourceQuery {
            kind,
            query: String::new(),
            genre: String::new(),
        };
        Job::new(
            format!("discover:{}", kind.as_str()),
            Work::Catalog {
                query,
                discovery: true,
                previous: Vec::new(),
                details: Default::default(),
                has_next: false,
            },
        )
    }

    pub fn trending_job(kind: CatalogKind) -> Job {
        Job::new(format!("trending:{}", kind.as_str()), Work::Trending { kind, ids: Vec::new() })
    }

    pub fn catalog(&self, conn: &Connection, query: &BrowseQuery, empty: bool) -> AppResult<ImportStatus> {
        let text = query.query.trim();
        if text.is_empty() && query.genre.is_empty() {
            if query.kind != CatalogKind::Anime {
                return Ok(self.browse_status(empty, None));
            }
            let job = Self::discovery_job(CatalogKind::Anime);
            let key = job.key.clone();
            self.ensure(conn, job, if empty { Priority::Visible } else { Priority::Crawl })?;
            return Ok(self.browse_status(empty, Some(&key)));
        }
        let source = SourceQuery {
            kind: query.kind,
            query: text.to_owned(),
            genre: query.genre.clone(),
        };
        let key = format!("search:{}", serde_json::json!([source.kind.as_str(), source.query, source.genre]));
        let work = Work::Catalog {
            query: source,
            discovery: false,
            previous: Vec::new(),
            details: Default::default(),
            has_next: false,
        };
        self.ensure(conn, Job::new(key.clone(), work), Priority::Visible)?;
        Ok(self.key_status(Some(&key)))
    }

    fn request(&self, conn: &Connection, key: String, id: &str, work: Work, priority: Priority, episodes: bool) -> AppResult<ImportStatus> {
        if !detail_fresh(conn, id, episodes, self.inner.metadata.ms())? {
            self.ensure(conn, Job::new(key.clone(), work), priority)?;
        }
        Ok(self.key_status(Some(&key)))
    }

    fn import_title(&self, conn: &Connection, id: &str, hint: Option<MediaKind>, priority: Priority) -> AppResult<ImportStatus> {
        let work = Work::Title {
            id: id.to_owned(),
            kind: kind_of(conn, id)?.or(hint),
        };
        self.request(conn, format!("title:{id}"), id, work, priority, false)
    }

    pub fn title(&self, conn: &Connection, id: &str) -> AppResult<ImportStatus> {
        self.import_title(conn, id, None, Priority::Visible)
    }

    pub fn backfill(&self, conn: &Connection, id: &str, hint: Option<MediaKind>) -> AppResult<ImportStatus> {
        self.import_title(conn, id, hint, Priority::Backfill)
    }

    pub fn episodes(&self, conn: &Connection, id: &str) -> AppResult<ImportStatus> {
        let key = format!("episodes:{id}");
        if id.contains(':') || kind_of(conn, id)?.is_some_and(|kind| kind != MediaKind::Series) {
            return Ok(self.key_status(Some(&key)));
        }
        self.request(conn, key, id, Work::Episodes { id: id.to_owned() }, Priority::Visible, true)
    }

    pub fn titles(&self, ids: &[String]) -> ImportStatus {
        let keys: Vec<String> = ids.iter().map(|id| format!("title:{id}")).collect();
        self.inner
            .queue
            .lock()
            .unwrap()
            .group_status(&keys, self.inner.enabled, self.imported(), self.inner.metadata.ms())
    }

    pub fn trending(&self, kind: CatalogKind) -> ImportStatus {
        let keys: Vec<String> = match kind {
            CatalogKind::All => vec!["trending:movie".into(), "trending:series".into()],
            other => vec![format!("trending:{}", other.as_str())],
        };
        self.inner
            .queue
            .lock()
            .unwrap()
            .group_status(&keys, self.inner.enabled, self.imported(), self.inner.metadata.ms())
    }
}
