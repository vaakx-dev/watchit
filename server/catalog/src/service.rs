use std::sync::{Arc, OnceLock};

use rusqlite::Connection;
use watchit_artwork::{Artwork, ArtworkStatus};
use watchit_core::{AppError, AppResult, Context, Db};

use crate::attribution::Attribution;
use crate::model::{CatalogEntry, EpisodeEntry, MediaKind};
use crate::personal::{Personal, SeriesProgress, TitleExtras};
use crate::providers::Providers;
use crate::related::franchises::Franchises;
use crate::settings::MetadataHours;
use crate::store::browse::Facets;
use crate::store::entry::images;
use crate::store::{episodes, record, schema, titles};
use crate::sync::Sync;

#[derive(Clone)]
pub struct Catalog {
    pub(crate) inner: Arc<Inner>,
}

pub(crate) struct Inner {
    pub db: Db,
    pub artwork: Artwork,
    pub sync: Sync,
    pub franchises: Franchises,
    pub facets: Arc<Facets>,
    pub metadata: MetadataHours,
    pub providers: Providers,
    pub personal: OnceLock<Arc<dyn Personal>>,
}

fn enabled(variable: &str) -> bool {
    std::env::var(variable).map_or(true, |value| value != "off")
}

impl Catalog {
    pub fn open(context: &Context, artwork: Artwork) -> AppResult<Self> {
        let db = context.db.clone();
        let metadata = db.run_blocking(|conn| {
            schema::create(conn)?;
            MetadataHours::load(conn)
        })?;
        let syncing = enabled("WATCHIT_SYNC");
        let facets = Arc::new(Facets::default());
        let attribution = Attribution::open(context, &artwork)?;
        let sync = Sync::open(db.clone(), syncing, metadata.clone(), facets.clone(), attribution)?;
        let franchises = Franchises::new(db.clone(), syncing);
        sync.start(&context.background);
        franchises.start(&context.background);
        let providers = Providers::new(context.paths.root().join("providers.json"));
        let inner = Inner { db, artwork, sync, franchises, facets, metadata, providers, personal: OnceLock::new() };
        Ok(Self { inner: Arc::new(inner) })
    }

    pub fn set_personal(&self, personal: Arc<dyn Personal>) -> AppResult<()> {
        self.inner.personal.set(personal).map_err(|_| AppError::internal("personal data provider is already set"))
    }

    pub(crate) fn personal(&self) -> Option<&Arc<dyn Personal>> {
        self.inner.personal.get()
    }

    pub fn entries(&self, conn: &Connection, ids: &[String]) -> AppResult<(Vec<CatalogEntry>, ArtworkStatus)> {
        let rows = titles::rows(conn, ids)?;
        let images = images(conn, &self.inner.artwork, &rows)?;
        Ok((rows.iter().map(|row| row.entry(&images)).collect(), images.status))
    }

    pub fn episode_entries(&self, conn: &Connection, ids: &[String]) -> AppResult<(Vec<EpisodeEntry>, ArtworkStatus)> {
        let rows = titles::rows(conn, ids)?;
        let images = images(conn, &self.inner.artwork, &rows)?;
        Ok((rows.iter().map(|row| row.episode(&images)).collect(), images.status))
    }

    pub fn kind(&self, conn: &Connection, id: &str) -> AppResult<Option<MediaKind>> {
        record::kind_of(conn, id)
    }

    pub fn next_episode(&self, conn: &Connection, series_id: &str, after: Option<(i64, i64, &str)>) -> AppResult<Option<EpisodeEntry>> {
        let row = match after {
            Some((season, episode, id)) => {
                let at = episodes::Position { series_id: series_id.to_owned(), season, episode, id: id.to_owned() };
                episodes::neighbour(conn, &at, true)?
            }
            None => episodes::first(conn, series_id)?,
        };
        let images = images(conn, &self.inner.artwork, row.iter())?;
        Ok(row.map(|row| row.episode(&images)))
    }

    pub fn runtime_minutes(&self, conn: &Connection, id: &str) -> AppResult<Option<u32>> {
        record::runtime_minutes(conn, id)
    }

    pub fn season_episodes(&self, conn: &Connection, series_id: &str, season: i64) -> AppResult<Vec<String>> {
        episodes::season_ids(conn, series_id, season)
    }

    pub fn season_count(&self, conn: &Connection, series_id: &str) -> AppResult<i64> {
        episodes::season_count(conn, series_id)
    }

    pub fn import_title(&self, conn: &Connection, id: &str) -> AppResult<bool> {
        Ok(self.inner.sync.title(conn, id)?.pending)
    }

    pub fn backfill_title(&self, conn: &Connection, id: &str, kind: Option<MediaKind>) -> AppResult<()> {
        self.inner.sync.backfill(conn, id, kind)?;
        Ok(())
    }

    pub fn episodes_pending(&self, conn: &Connection, series_id: &str) -> AppResult<bool> {
        Ok(self.inner.sync.episodes(conn, series_id)?.pending)
    }

    pub(crate) fn default_extras(&self, conn: &Connection, series_id: Option<&str>) -> AppResult<TitleExtras> {
        let progress = match series_id {
            Some(series_id) => Some(SeriesProgress { last: None, next: self.next_episode(conn, series_id, None)?, resume: None, opened_at: None }),
            None => None,
        };
        Ok(TitleExtras { playback_source: None, progress, resume: None })
    }
}
