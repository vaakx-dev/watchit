use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, AtomicI64, AtomicU64, Ordering};
use std::sync::{Arc, Mutex, RwLock};

use futures::FutureExt;
use futures::future::{BoxFuture, Shared};
use tokio::sync::{Notify, broadcast};
use watchit_core::Db;

use crate::clock::now_ms;
use crate::download::{MAX_IMAGE_BYTES, Transport};
use crate::encode::encode;
use crate::failure::ImageFailure;
use crate::key::ImageKey;
use crate::records::{self, ImageRecord};
use crate::settings::ImageSettings;
use crate::slots::Slots;

const HOUR_MS: i64 = 3_600_000;
const FULL: f64 = 0.9;
const EVICTION_BATCH: usize = 1000;

#[derive(Clone, Debug)]
pub(crate) struct Cached {
    pub path: PathBuf,
    pub fetched_at: i64,
    pub bytes: i64,
    pub stale: bool,
    pub error: Option<ImageFailure>,
}

#[derive(Clone, Debug)]
pub struct Fetched {
    pub key: ImageKey,
    pub fetched_at: i64,
}

type Flight = Shared<BoxFuture<'static, Result<Cached, ImageFailure>>>;

struct Request {
    flight: Flight,
    background: Arc<AtomicBool>,
    promoted: Arc<Notify>,
}

pub(crate) struct Cache {
    db: Db,
    folder: PathBuf,
    pub settings: RwLock<ImageSettings>,
    transport: Transport,
    slots: Slots,
    requests: Mutex<HashMap<ImageKey, Request>>,
    used: AtomicI64,
    commits: tokio::sync::Mutex<()>,
    temporary: AtomicU64,
    pub fetched: broadcast::Sender<Fetched>,
}

fn file_size(path: &PathBuf) -> Option<i64> {
    std::fs::metadata(path).ok().filter(|meta| meta.is_file()).map(|meta| meta.len() as i64)
}

impl Cache {
    pub fn new(db: Db, folder: PathBuf, settings: ImageSettings, used: i64) -> Self {
        Self {
            db,
            folder,
            settings: RwLock::new(settings),
            transport: Transport::new(),
            slots: Slots::new(),
            requests: Mutex::new(HashMap::new()),
            used: AtomicI64::new(used),
            commits: tokio::sync::Mutex::new(()),
            temporary: AtomicU64::new(0),
            fetched: broadcast::channel(256).0,
        }
    }

    pub fn settings(&self) -> ImageSettings {
        *self.settings.read().unwrap()
    }

    pub fn full(&self) -> bool {
        self.used.load(Ordering::Relaxed) as f64 >= self.settings().limit_bytes() as f64 * FULL
    }

    pub fn loading(&self, key: &ImageKey) -> bool {
        self.requests.lock().unwrap().contains_key(key)
    }

    fn path(&self, key: &ImageKey) -> PathBuf {
        self.folder.join(key.as_str())
    }

    pub async fn get(self: &Arc<Self>, key: &ImageKey, background: bool) -> Result<Cached, ImageFailure> {
        let flight = {
            let mut requests = self.requests.lock().unwrap();
            match requests.get(key) {
                Some(request) => {
                    if !background && request.background.swap(false, Ordering::Relaxed) {
                        request.promoted.notify_one();
                    }
                    request.flight.clone()
                }
                None => {
                    let flag = Arc::new(AtomicBool::new(background));
                    let promoted = Arc::new(Notify::new());
                    let task = tokio::spawn({
                        let cache = self.clone();
                        let (key, flag, promoted) = (key.clone(), flag.clone(), promoted.clone());
                        async move {
                            let result = cache.load(&key, &flag, &promoted).await;
                            cache.requests.lock().unwrap().remove(&key);
                            result
                        }
                    });
                    let flight = async move { task.await.unwrap_or_else(|_| Err(ImageFailure::unavailable("Image download stopped"))) }
                        .boxed()
                        .shared();
                    requests.insert(key.clone(), Request { flight: flight.clone(), background: flag, promoted });
                    flight
                }
            }
        };
        flight.await
    }

    async fn load(&self, key: &ImageKey, background: &AtomicBool, promoted: &Notify) -> Result<Cached, ImageFailure> {
        let lookup = key.clone();
        let record = self
            .db
            .run(move |conn| records::get(conn, &lookup))
            .await?
            .ok_or_else(|| ImageFailure::rejected("Image not found"))?;
        let settings = self.settings();
        let lifetime = settings.lifetime_ms(key.jitter());
        let path = self.path(key);
        let resident = record.fetched_at.is_some() && record.bytes > 0 && file_size(&path) == Some(record.bytes);
        let age = record.fetched_at.map(|fetched_at| now_ms() - fetched_at);
        if resident && age.is_some_and(|age| (0..lifetime).contains(&age)) {
            return Ok(self.serve(&record, background.load(Ordering::Relaxed), false, None).await);
        }
        if !resident && record.fetched_at.is_some() {
            self.forget(vec![(record.key.clone(), record.bytes)]).await?;
        }
        match self.refresh(&record, resident, background, promoted).await {
            Ok(cached) => Ok(cached),
            Err(failure) => {
                let within = age.is_some_and(|age| age >= 0 && age <= lifetime + settings.stale_ms());
                if resident && settings.max_stale_days > 0.0 && within && file_size(&path) == Some(record.bytes) {
                    return Ok(self.serve(&record, background.load(Ordering::Relaxed), true, Some(failure)).await);
                }
                Err(failure)
            }
        }
    }

    async fn serve(&self, record: &ImageRecord, background: bool, stale: bool, error: Option<ImageFailure>) -> Cached {
        let now = now_ms();
        if !background && now - record.accessed_at >= HOUR_MS {
            let key = record.key.clone();
            if let Err(error) = self.db.run(move |conn| records::touch(conn, &key, now)).await {
                tracing::warn!(%error, "image access time not saved");
            }
        }
        let fetched_at = record.fetched_at.unwrap_or(0);
        Cached { path: self.path(&record.key), fetched_at, bytes: record.bytes, stale, error }
    }

    async fn refresh(&self, record: &ImageRecord, resident: bool, background: &AtomicBool, promoted: &Notify) -> Result<Cached, ImageFailure> {
        let limit = (self.settings().limit_bytes().max(0) as usize).min(MAX_IMAGE_BYTES);
        let downloaded = {
            let _slot = self.slots.download(background.load(Ordering::Relaxed), promoted).await;
            self.transport.download(&record.source_url, limit).await?
        };
        let encoded = {
            let _permit = self.slots.encode().await;
            tokio::task::spawn_blocking(move || encode(&downloaded))
                .await
                .map_err(|_| ImageFailure::unavailable("Image encoding stopped"))??
        };
        let _commit = self.commits.lock().await;
        let growth = encoded.len() as i64 - if resident { record.bytes } else { 0 };
        let background = background.load(Ordering::Relaxed);
        self.make_space(&record.key, growth, background).await?;
        let path = self.path(&record.key);
        self.write(&path, &encoded).await?;
        self.used.fetch_add(growth, Ordering::Relaxed);
        let fetched_at = now_ms();
        let accessed_at = if background { record.accessed_at } else { fetched_at };
        let (key, bytes) = (record.key.clone(), encoded.len() as i64);
        self.db.run(move |conn| records::stored(conn, &key, bytes, fetched_at, accessed_at)).await?;
        let _ = self.fetched.send(Fetched { key: record.key.clone(), fetched_at });
        Ok(Cached { path, fetched_at, bytes, stale: false, error: None })
    }

    async fn write(&self, path: &PathBuf, bytes: &[u8]) -> Result<(), ImageFailure> {
        let suffix = self.temporary.fetch_add(1, Ordering::Relaxed);
        let temporary = path.with_extension(format!("{}.{suffix}.tmp", std::process::id()));
        let written = async {
            tokio::fs::write(&temporary, bytes).await?;
            tokio::fs::rename(&temporary, path).await
        }
        .await;
        if written.is_err() {
            let _ = tokio::fs::remove_file(&temporary).await;
        }
        written.map_err(|error| ImageFailure::unavailable(format!("Image could not be stored: {error}")))
    }

    async fn make_space(&self, key: &ImageKey, growth: i64, background: bool) -> Result<(), ImageFailure> {
        let limit = self.settings().limit_bytes();
        if growth > limit {
            return Err(ImageFailure::rejected("Image exceeds the cache budget"));
        }
        let used = || self.used.load(Ordering::Relaxed);
        if used() + growth <= limit {
            return Ok(());
        }
        if background {
            return Err(ImageFailure::rejected("Image cache is full"));
        }
        let target = limit as f64 * FULL;
        while (used() + growth) as f64 > target {
            let candidates = self.db.run(|conn| records::least_recent(conn, EVICTION_BATCH)).await?;
            let mut excess = (used() + growth) as f64 - target;
            let mut evicted = Vec::new();
            for (candidate, bytes) in candidates {
                if excess <= 0.0 {
                    break;
                }
                if &candidate == key || self.loading(&candidate) {
                    continue;
                }
                excess -= bytes as f64;
                evicted.push((candidate, bytes));
            }
            if evicted.is_empty() {
                break;
            }
            for (candidate, _) in &evicted {
                let _ = tokio::fs::remove_file(self.path(candidate)).await;
            }
            self.forget(evicted).await?;
        }
        if used() + growth > limit {
            return Err(ImageFailure::rejected("Image cache is busy or has no free space"));
        }
        Ok(())
    }

    async fn forget(&self, images: Vec<(ImageKey, i64)>) -> Result<(), ImageFailure> {
        let freed: i64 = images.iter().map(|(_, bytes)| bytes).sum();
        let keys: Vec<ImageKey> = images.into_iter().map(|(key, _)| key).collect();
        self.db.run(move |conn| records::clear(conn, &keys)).await?;
        self.used.fetch_sub(freed, Ordering::Relaxed);
        Ok(())
    }
}
