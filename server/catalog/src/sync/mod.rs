mod jobs;
mod publish;
mod status;
mod steps;
mod worker;

use std::sync::atomic::AtomicI64;
use std::sync::{Arc, Mutex};

use rusqlite::{Connection, params};
use tokio::sync::Notify;
use watchit_core::{AppError, AppResult, Db};

use crate::attribution::Attribution;
use crate::cinemeta::source::Source;
use crate::settings::MetadataHours;
use crate::store::browse::Facets;
use crate::store::record::browsable_count;
use jobs::{Job, Queue};

pub(crate) struct Inner {
    db: Db,
    source: Source,
    queue: Mutex<Queue>,
    wake: Notify,
    enabled: bool,
    metadata: MetadataHours,
    imported: AtomicI64,
    facets: Arc<Facets>,
    attribution: Attribution,
}

#[derive(Clone)]
pub(crate) struct Sync {
    inner: Arc<Inner>,
}

fn load_jobs(conn: &Connection) -> AppResult<Vec<Job>> {
    let mut statement = conn.prepare("SELECT state FROM import_jobs")?;
    let rows = statement.query_map([], |row| row.get::<_, String>(0))?;
    let mut jobs = Vec::new();
    for row in rows {
        if let Ok(mut job) = serde_json::from_str::<Job>(&row?) {
            job.priority = job.default_priority();
            if !job.finished_detail() {
                jobs.push(job);
            }
        }
    }
    Ok(jobs)
}

pub(crate) fn save_job(conn: &Connection, job: &Job) -> AppResult<()> {
    let state = serde_json::to_string(job).map_err(AppError::internal)?;
    conn.prepare_cached("INSERT INTO import_jobs (key, state) VALUES (?1, ?2) ON CONFLICT(key) DO UPDATE SET state = excluded.state")?
        .execute(params![job.key, state])?;
    Ok(())
}

pub(crate) fn delete_job(conn: &Connection, key: &str) -> AppResult<()> {
    conn.prepare_cached("DELETE FROM import_jobs WHERE key = ?1")?.execute([key])?;
    Ok(())
}

impl Sync {
    pub fn open(db: Db, enabled: bool, metadata: MetadataHours, facets: Arc<Facets>, attribution: Attribution) -> AppResult<Self> {
        let (jobs, imported) = db.run_blocking(|conn| {
            Ok((load_jobs(conn)?, browsable_count(conn)?))
        })?;
        let mut queue = Queue::default();
        for job in jobs {
            queue.insert(job);
        }
        Ok(Self {
            inner: Arc::new(Inner {
                db,
                source: Source::new(),
                queue: Mutex::new(queue),
                wake: Notify::new(),
                enabled,
                metadata,
                imported: AtomicI64::new(imported),
                facets,
                attribution,
            }),
        })
    }
}
