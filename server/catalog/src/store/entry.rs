use rusqlite::{Connection, Row};
use watchit_artwork::{Artwork, ImageKey, ImageSet};
use watchit_core::AppResult;

use crate::clock::{iso, now_ms};
use crate::model::{CatalogEntry, EpisodeEntry, Freshness, MediaKind};

pub(crate) const ENTRY_COLUMNS: &str = "titles.id, titles.title, titles.year, titles.poster, titles.genres, titles.kind, titles.anime,
    titles.imdb_rating, titles.updated_at, titles.season, titles.episode,
    CASE WHEN titles.kind = 'episode' THEN json_extract(titles.detail, '$.synopsis') END";
pub(crate) const ENTRY_WIDTH: usize = 12;

pub(crate) struct EntryRow {
    pub id: String,
    pub title: String,
    pub year: Option<i64>,
    pub poster: Option<ImageKey>,
    pub genres: Vec<String>,
    pub kind: MediaKind,
    pub anime: bool,
    pub imdb_rating: Option<f64>,
    pub updated_at: i64,
    pub season: Option<i64>,
    pub episode: Option<i64>,
    pub synopsis: Option<String>,
}

impl EntryRow {
    pub fn read(row: &Row<'_>) -> rusqlite::Result<Self> {
        let poster: Option<String> = row.get(3)?;
        let genres: String = row.get(4)?;
        let kind: String = row.get(5)?;
        Ok(Self {
            id: row.get(0)?,
            title: row.get(1)?,
            year: row.get(2)?,
            poster: poster.as_deref().and_then(ImageKey::parse),
            genres: serde_json::from_str(&genres).unwrap_or_default(),
            kind: MediaKind::parse(&kind).unwrap_or(MediaKind::Movie),
            anime: row.get(6)?,
            imdb_rating: row.get(7)?,
            updated_at: row.get(8)?,
            season: row.get(9)?,
            episode: row.get(10)?,
            synopsis: row.get(11)?,
        })
    }

    pub fn entry(&self, images: &ImageSet) -> CatalogEntry {
        CatalogEntry {
            id: self.id.clone(),
            title: self.title.clone(),
            year: self.year,
            artwork: self.poster.as_ref().map(|key| images.url(key)).unwrap_or_default(),
            genres: self.genres.clone(),
            kind: self.kind,
            anime: self.anime,
            imdb_rating: self.imdb_rating,
        }
    }

    pub fn episode(&self, images: &ImageSet) -> EpisodeEntry {
        EpisodeEntry {
            entry: self.entry(images),
            season: self.season,
            episode: self.episode,
            synopsis: self.synopsis.clone().unwrap_or_default(),
        }
    }
}

pub(crate) fn images<'a>(conn: &Connection, artwork: &Artwork, rows: impl IntoIterator<Item = &'a EntryRow>) -> AppResult<ImageSet> {
    let keys: Vec<ImageKey> = rows.into_iter().filter_map(|row| row.poster.clone()).collect();
    artwork.lookup(conn, &keys)
}

pub(crate) fn freshness(rows: &[EntryRow], metadata_ms: i64) -> Freshness {
    let Some(updated_at) = rows.iter().map(|row| row.updated_at).min() else {
        return Freshness { updated_at: String::new(), stale: false };
    };
    let age = now_ms() - updated_at;
    Freshness {
        updated_at: if updated_at > 0 { iso(updated_at) } else { String::new() },
        stale: updated_at == 0 || age < 0 || age >= metadata_ms,
    }
}

pub(crate) fn page_rows(statement: &mut rusqlite::Statement<'_>, params: impl rusqlite::Params) -> AppResult<(Vec<EntryRow>, bool)> {
    let mut rows: Vec<EntryRow> = statement.query_map(params, EntryRow::read)?.collect::<rusqlite::Result<_>>()?;
    let has_next = rows.len() > PAGE_SIZE;
    rows.truncate(PAGE_SIZE);
    Ok((rows, has_next))
}

pub(crate) const PAGE_SIZE: usize = 24;

pub(crate) fn offset(page: u32) -> i64 {
    i64::from(page.saturating_sub(1)) * PAGE_SIZE as i64
}
