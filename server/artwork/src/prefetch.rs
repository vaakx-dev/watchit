use std::collections::{HashSet, VecDeque};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use tokio::sync::Notify;
use tokio::task::JoinSet;
use watchit_core::{AppResult, Db};

use crate::cache::Cache;
use crate::clock::now_ms;
use crate::failure::ImageFailure;
use crate::key::ImageKey;
use crate::records;

const CONCURRENCY: usize = 2;
const BATCH: usize = 100;
const RETRY_MS: i64 = 60_000;
const DAY_MS: i64 = 86_400_000;

#[derive(Default)]
struct State {
    urgent: VecDeque<ImageKey>,
    batch: VecDeque<ImageKey>,
    active: HashSet<ImageKey>,
    cursor: String,
    idle: bool,
    paused_until: i64,
    error: Option<String>,
}

pub(crate) struct Prefetch {
    cache: Arc<Cache>,
    db: Db,
    state: Mutex<State>,
    wake: Notify,
}

pub(crate) struct Overview {
    pub busy: bool,
    pub running: bool,
    pub error: Option<String>,
}

impl Prefetch {
    pub fn new(cache: Arc<Cache>, db: Db) -> Self {
        Self {
            cache,
            db,
            state: Mutex::new(State::default()),
            wake: Notify::new(),
        }
    }

    pub fn running(&self, key: &ImageKey) -> bool {
        self.state.lock().unwrap().active.contains(key)
    }

    pub fn overview(&self) -> Overview {
        let state = self.state.lock().unwrap();
        Overview {
            busy: !state.active.is_empty() || !state.urgent.is_empty() || !state.idle,
            running: !state.active.is_empty(),
            error: state.error.clone(),
        }
    }

    pub fn prioritise(&self, keys: impl IntoIterator<Item = ImageKey>) {
        let mut state = self.state.lock().unwrap();
        let mut added = false;
        for key in keys {
            if !state.active.contains(&key) && !state.urgent.contains(&key) {
                state.urgent.push_back(key);
                added = true;
            }
        }
        if added {
            state.idle = false;
            drop(state);
            self.wake.notify_one();
        }
    }

    pub async fn run(self: Arc<Self>, stopping: impl Future<Output = ()>) {
        let mut jobs = JoinSet::new();
        let mut stopping = std::pin::pin!(stopping);
        loop {
            let delay = match self.fill(&mut jobs).await {
                Ok(delay) => delay,
                Err(error) => {
                    self.state.lock().unwrap().error = Some(error.message);
                    Some(RETRY_MS)
                }
            };
            let sleep = tokio::time::sleep(Duration::from_millis(delay.unwrap_or(RETRY_MS).max(0) as u64));
            tokio::select! {
                Some(_) = jobs.join_next(), if !jobs.is_empty() => {}
                () = self.wake.notified() => {}
                () = sleep, if delay.is_some() || jobs.is_empty() => {}
                () = &mut stopping => break,
            }
        }
        jobs.shutdown().await;
    }

    async fn fill(self: &Arc<Self>, jobs: &mut JoinSet<()>) -> AppResult<Option<i64>> {
        let paused = self.state.lock().unwrap().paused_until - now_ms();
        if paused > 0 {
            return Ok(Some(paused));
        }
        if self.cache.full() {
            self.state.lock().unwrap().idle = true;
            return Ok(Some(RETRY_MS));
        }
        while jobs.len() < CONCURRENCY {
            let Some(key) = self.next().await? else {
                return Ok(jobs.is_empty().then_some(RETRY_MS));
            };
            self.state.lock().unwrap().active.insert(key.clone());
            let worker = self.clone();
            jobs.spawn(async move {
                worker.fetch(&key).await;
                worker.state.lock().unwrap().active.remove(&key);
            });
        }
        Ok(None)
    }

    async fn next(&self) -> AppResult<Option<ImageKey>> {
        loop {
            let (urgent, cursor) = {
                let mut state = self.state.lock().unwrap();
                let urgent = state.urgent.pop_front().or_else(|| state.batch.pop_front());
                (urgent, state.cursor.clone())
            };
            if let Some(key) = urgent {
                if self.running(&key) {
                    continue;
                }
                return Ok(Some(key));
            }
            let days = self.cache.settings().images_days;
            let due = self.db.run(move |conn| records::due(conn, &cursor, now_ms(), days, BATCH)).await?;
            let mut state = self.state.lock().unwrap();
            match due.last() {
                Some(last) => {
                    state.cursor = last.as_str().to_owned();
                    state.batch.extend(due);
                }
                None => {
                    state.cursor.clear();
                    state.idle = true;
                    return Ok(None);
                }
            }
            state.idle = false;
        }
    }

    async fn fetch(&self, key: &ImageKey) {
        let failure = match self.cache.get(key, true).await {
            Ok(cached) => cached.error,
            Err(failure) => Some(failure),
        };
        {
            let mut state = self.state.lock().unwrap();
            state.error = failure.as_ref().map(|failure| failure.message().to_owned());
            if let Some(failure) = &failure {
                state.paused_until = state.paused_until.max(failure.retry_at());
            }
        }
        if let Some(failure) = failure
            && let Err(error) = self.record_failure(key, failure).await
        {
            tracing::warn!(%error, "image failure not saved");
        }
    }

    async fn record_failure(&self, key: &ImageKey, failure: ImageFailure) -> AppResult<()> {
        let settings = self.cache.settings();
        let key = key.clone();
        self.db
            .run(move |conn| {
                let Some(record) = records::get(conn, &key)? else { return Ok(()) };
                let now = now_ms();
                let retry_at = if failure.permanent() {
                    now + settings.permanent_retry_ms()
                } else {
                    let backoff = RETRY_MS.saturating_mul(1 << record.failures.clamp(0, 20)).min(DAY_MS);
                    (now + backoff).max(failure.retry_at())
                };
                records::failed(conn, &key, retry_at, failure.message())
            })
            .await
    }
}
