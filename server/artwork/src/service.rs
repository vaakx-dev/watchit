use std::collections::HashMap;
use std::sync::Arc;

use rusqlite::Connection;
use serde::Serialize;
use tokio::sync::broadcast;
use ts_rs::TS;
use watchit_core::{AppError, AppResult, Background, Context, Db};

use crate::cache::{Cache, Cached, Fetched};
use crate::clock::now_ms;
use crate::key::ImageKey;
use crate::prefetch::Prefetch;
use crate::records;
use crate::settings::{ImageSettings, ImageSettingsPatch};

#[derive(Clone, Debug, Default, Serialize, TS)]
#[ts(export_to = "artwork/")]
pub struct ArtworkStatus {
    pub pending: bool,
    pub running: bool,
    pub error: Option<String>,
}

#[derive(Clone, Copy, Debug, Serialize, TS)]
#[ts(export_to = "artwork/")]
pub struct ImageUsage {
    pub image_count: i64,
    pub image_bytes: i64,
}

#[derive(Debug, Default)]
pub struct ImageSet {
    versions: HashMap<ImageKey, i64>,
    pub status: ArtworkStatus,
}

impl ImageSet {
    pub fn url(&self, key: &ImageKey) -> String {
        match self.versions.get(key) {
            Some(fetched_at) => format!("{}?v={fetched_at}", key.path()),
            None => key.path(),
        }
    }

    pub fn fetched_at(&self, key: &ImageKey) -> Option<i64> {
        self.versions.get(key).copied()
    }
}

#[derive(Clone)]
pub struct Artwork {
    inner: Arc<Inner>,
}

struct Inner {
    db: Db,
    cache: Arc<Cache>,
    prefetch: Arc<Prefetch>,
    prefetching: bool,
    background: Background,
}

impl Artwork {
    pub fn open(context: &Context) -> AppResult<Self> {
        let db = context.db.clone();
        let folder = context.paths.folder("images").map_err(AppError::internal)?;
        let (settings, (_, used)) = db.run_blocking(|conn| {
            records::create(conn)?;
            Ok((ImageSettings::load(conn)?, records::usage(conn)?))
        })?;
        let cache = Arc::new(Cache::new(db.clone(), folder, settings, used));
        let prefetch = Arc::new(Prefetch::new(cache.clone(), db.clone()));
        let background = context.background.clone();
        let prefetching = ["WATCHIT_SYNC", "WATCHIT_ARTWORK"]
            .iter()
            .all(|name| std::env::var(name).map_or(true, |value| value != "off"));
        let artwork = Self {
            inner: Arc::new(Inner {
                db,
                cache,
                prefetch,
                prefetching,
                background,
            }),
        };
        artwork.start();
        Ok(artwork)
    }

    fn start(&self) {
        if self.inner.prefetching {
            let background = &self.inner.background;
            background.spawn(self.inner.prefetch.clone().run(background.stopping()));
        }
    }

    pub fn register(conn: &Connection, sources: &[(ImageKey, String)]) -> AppResult<()> {
        records::register(conn, sources)
    }

    pub fn versions(conn: &Connection, keys: &[ImageKey]) -> AppResult<ImageSet> {
        let versions = records::many(conn, keys)?
            .into_iter()
            .filter_map(|record| record.fetched_at.map(|fetched_at| (record.key, fetched_at)))
            .collect();
        Ok(ImageSet {
            versions,
            status: ArtworkStatus::default(),
        })
    }

    pub fn lookup(&self, conn: &Connection, keys: &[ImageKey]) -> AppResult<ImageSet> {
        let found = records::many(conn, keys)?;
        let settings = self.inner.cache.settings();
        let now = now_ms();
        let mut versions = HashMap::with_capacity(found.len());
        let mut stale = Vec::new();
        for record in found {
            if let Some(fetched_at) = record.fetched_at {
                versions.insert(record.key.clone(), fetched_at);
            }
            let age = record.fetched_at.map(|fetched_at| now - fetched_at);
            let fresh = record.bytes > 0 && age.is_some_and(|age| (0..settings.lifetime_ms(record.key.jitter())).contains(&age));
            if !fresh {
                stale.push(record);
            }
        }
        let active = self.inner.prefetching && !self.inner.cache.full();
        let running = keys.iter().any(|key| self.inner.prefetch.running(key) || self.inner.cache.loading(key));
        let error = stale.iter().find_map(|record| record.error.clone());
        let pending = active && !stale.is_empty();
        if active {
            self.inner
                .prefetch
                .prioritise(stale.into_iter().filter(|record| record.retry_at <= now).map(|record| record.key));
        }
        Ok(ImageSet {
            versions,
            status: ArtworkStatus { pending, running, error },
        })
    }

    pub fn status(&self) -> ArtworkStatus {
        let overview = self.inner.prefetch.overview();
        ArtworkStatus {
            pending: self.inner.prefetching && !self.inner.cache.full() && overview.busy,
            running: overview.running,
            error: overview.error,
        }
    }

    pub fn settings(&self) -> ImageSettings {
        self.inner.cache.settings()
    }

    pub fn update_settings(&self, conn: &Connection, patch: &ImageSettingsPatch) -> AppResult<ImageSettings> {
        patch.validate()?;
        let mut settings = self.inner.cache.settings.write().unwrap();
        *settings = settings.apply(patch, conn)?;
        Ok(*settings)
    }

    pub fn usage(conn: &Connection) -> AppResult<ImageUsage> {
        let (image_count, image_bytes) = records::usage(conn)?;
        Ok(ImageUsage { image_count, image_bytes })
    }

    pub fn subscribe(&self) -> broadcast::Receiver<Fetched> {
        self.inner.cache.fetched.subscribe()
    }

    pub(crate) fn db(&self) -> &Db {
        &self.inner.db
    }

    pub(crate) async fn image(&self, key: &ImageKey) -> AppResult<Cached> {
        Ok(self.inner.cache.get(key, false).await?)
    }
}
