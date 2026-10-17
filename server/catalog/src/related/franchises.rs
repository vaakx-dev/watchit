use std::collections::VecDeque;
use std::sync::{Arc, Mutex};
use std::time::Duration;

use rusqlite::{Connection, OptionalExtension, params};
use tokio::sync::Notify;
use watchit_core::{AppResult, Background, Db};

use crate::clock::{DAY_MS, HOUR_MS, now_ms};
use crate::related::wikidata::{FranchiseList, fetch_franchise};

const FOUND_MS: i64 = 30 * DAY_MS;
const MISSING_MS: i64 = 7 * DAY_MS;
const FAILED_MS: i64 = HOUR_MS;
const GAP: Duration = Duration::from_secs(1);

struct Cached {
    list: FranchiseList,
    failed: bool,
    updated_at: i64,
}

impl Cached {
    fn fresh(&self) -> bool {
        let lifetime = if self.failed { FAILED_MS } else if self.list.ids.is_empty() { MISSING_MS } else { FOUND_MS };
        now_ms() - self.updated_at < lifetime
    }
}

pub(crate) struct Lookup {
    pub franchise: Option<FranchiseList>,
    pub pending: bool,
}

#[derive(Clone)]
pub(crate) struct Franchises {
    inner: Arc<Inner>,
}

struct Inner {
    db: Db,
    enabled: bool,
    queue: Mutex<VecDeque<String>>,
    wake: Notify,
}

fn cached(conn: &Connection, imdb_id: &str) -> AppResult<Option<Cached>> {
    let row = conn
        .prepare_cached("SELECT name, ids, failed, updated_at FROM franchises WHERE imdb_id = ?1")?
        .query_row([imdb_id], |row| {
            Ok((row.get::<_, Option<String>>(0)?, row.get::<_, String>(1)?, row.get::<_, bool>(2)?, row.get::<_, i64>(3)?))
        })
        .optional()?;
    Ok(row.map(|(name, ids, failed, updated_at)| Cached {
        list: FranchiseList { name, ids: serde_json::from_str(&ids).unwrap_or_default() },
        failed,
        updated_at,
    }))
}

fn store(conn: &Connection, imdb_id: &str, list: &FranchiseList, failed: bool) -> AppResult<()> {
    conn.prepare_cached(
        "INSERT INTO franchises (imdb_id, name, ids, failed, updated_at) VALUES (?1, ?2, ?3, ?4, ?5)
         ON CONFLICT(imdb_id) DO UPDATE SET name = excluded.name, ids = excluded.ids, failed = excluded.failed, updated_at = excluded.updated_at",
    )?
    .execute(params![imdb_id, list.name, serde_json::to_string(&list.ids).unwrap_or_default(), failed, now_ms()])?;
    Ok(())
}

impl Franchises {
    pub fn new(db: Db, enabled: bool) -> Self {
        Self { inner: Arc::new(Inner { db, enabled, queue: Mutex::new(VecDeque::new()), wake: Notify::new() }) }
    }

    pub fn start(&self, background: &Background) {
        if self.inner.enabled {
            background.spawn(self.inner.clone().run(background.stopping()));
        }
    }

    pub fn get(&self, conn: &Connection, imdb_id: &str) -> AppResult<Lookup> {
        let record = cached(conn, imdb_id)?;
        if self.inner.enabled && !record.as_ref().is_some_and(Cached::fresh) {
            let mut queue = self.inner.queue.lock().unwrap();
            if !queue.iter().any(|queued| queued == imdb_id) {
                queue.push_back(imdb_id.to_owned());
                self.inner.wake.notify_one();
            }
        }
        Ok(Lookup { pending: self.inner.enabled && record.is_none(), franchise: record.map(|record| record.list) })
    }
}

impl Inner {
    async fn run(self: Arc<Self>, stopping: impl Future<Output = ()>) {
        let client = reqwest::Client::new();
        let mut stopping = std::pin::pin!(stopping);
        loop {
            let next = self.queue.lock().unwrap().front().cloned();
            let Some(imdb_id) = next else {
                tokio::select! {
                    () = self.wake.notified() => continue,
                    () = &mut stopping => return,
                }
            };
            let fetched = tokio::select! {
                fetched = fetch_franchise(&client, &imdb_id) => fetched,
                () = &mut stopping => return,
            };
            let id = imdb_id.clone();
            let saved = self
                .db
                .run(move |conn| match fetched {
                    Ok(list) => store(conn, &id, &list, false),
                    Err(_) => {
                        let previous = cached(conn, &id)?.map(|cached| cached.list).unwrap_or_default();
                        store(conn, &id, &previous, true)
                    }
                })
                .await;
            if let Err(error) = saved {
                tracing::warn!(%error, "franchise not saved");
            }
            self.queue.lock().unwrap().pop_front();
            tokio::select! {
                () = tokio::time::sleep(GAP) => {}
                () = &mut stopping => return,
            }
        }
    }
}
