use rusqlite::{Connection, OptionalExtension, params};
use serde::{Deserialize, Serialize};
use watchit_artwork::{Artwork, ImageKey};
use watchit_core::{AppError, AppResult};

use crate::clock::now_ms;
use crate::genres::Genre;
use crate::ids::genre_id;
use crate::model::{MediaKind, SeriesRef};

#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize)]
pub(crate) struct Detail {
    pub imdb_id: Option<String>,
    pub tmdb_id: Option<i64>,
    pub minutes: Option<i64>,
    pub synopsis: String,
    pub director: String,
    pub cast: String,
    pub poster: Option<String>,
    pub background: Option<String>,
    pub trailers: Vec<String>,
    pub source_url: String,
    pub series: Option<SeriesRef>,
}

#[derive(Clone, Debug, PartialEq)]
pub(crate) struct Record {
    pub id: String,
    pub kind: MediaKind,
    pub title: String,
    pub year: Option<i64>,
    pub genres: Vec<Genre>,
    pub anime: bool,
    pub imdb_rating: Option<f64>,
    pub popularity: Option<f64>,
    pub season: Option<i64>,
    pub episode: Option<i64>,
    pub detail: Detail,
}

impl Record {
    pub fn new(id: &str, kind: MediaKind) -> Self {
        Self {
            id: id.to_owned(),
            kind,
            title: String::new(),
            year: None,
            genres: Vec::new(),
            anime: false,
            imdb_rating: None,
            popularity: None,
            season: None,
            episode: None,
            detail: Detail::default(),
        }
    }

    pub fn series_id(&self) -> Option<&str> {
        self.detail.series.as_ref().map(|series| series.id.as_str())
    }

    pub fn poster_key(&self) -> Option<ImageKey> {
        self.detail
            .poster
            .as_deref()
            .and_then(|url| ImageKey::for_source(url).ok())
            .map(|(key, _)| key)
    }

    pub fn genre_labels(&self) -> Vec<String> {
        self.genres.iter().map(|genre| genre.label.clone()).collect()
    }
}

const RECORD_COLUMNS: &str = "kind, title, year, anime, imdb_rating, popularity, season, episode, detail, genres";

pub(crate) fn load(conn: &Connection, id: &str) -> AppResult<Option<Record>> {
    let sql = format!("SELECT {RECORD_COLUMNS} FROM titles WHERE id = ?1");
    let row = conn
        .prepare_cached(&sql)?
        .query_row([id], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, Option<i64>>(2)?,
                row.get::<_, bool>(3)?,
                row.get::<_, Option<f64>>(4)?,
                row.get::<_, Option<f64>>(5)?,
                row.get::<_, Option<i64>>(6)?,
                row.get::<_, Option<i64>>(7)?,
                row.get::<_, String>(8)?,
                row.get::<_, String>(9)?,
            ))
        })
        .optional()?;
    let Some((kind, title, year, anime, imdb_rating, popularity, season, episode, detail, genres)) = row else {
        return Ok(None);
    };
    let labels: Vec<String> = serde_json::from_str(&genres).map_err(AppError::internal)?;
    let genres = labels.into_iter().map(|label| Genre { id: genre_id(&label), label }).collect();
    Ok(Some(Record {
        id: id.to_owned(),
        kind: MediaKind::parse(&kind).ok_or_else(|| AppError::internal("unknown title kind"))?,
        title,
        year,
        genres,
        anime,
        imdb_rating,
        popularity,
        season,
        episode,
        detail: serde_json::from_str(&detail).map_err(AppError::internal)?,
    }))
}

pub(crate) fn save(conn: &Connection, records: &[Record], verified_at: Option<i64>) -> AppResult<Vec<String>> {
    let now = now_ms();
    let mut changed = Vec::new();
    let mut images = Vec::new();
    for record in records {
        if let Some(source) = record.detail.poster.as_deref().and_then(|url| ImageKey::for_source(url).ok()) {
            images.push(source);
        }
        if load(conn, &record.id)?.as_ref() == Some(record) {
            conn.prepare_cached("UPDATE titles SET updated_at = ?2, verified_at = COALESCE(?3, verified_at) WHERE id = ?1")?
                .execute(params![record.id, now, verified_at])?;
            continue;
        }
        write(conn, record, now, verified_at)?;
        changed.push(record.id.clone());
    }
    Artwork::register(conn, &images)?;
    Ok(changed)
}

fn write(conn: &Connection, record: &Record, now: i64, verified_at: Option<i64>) -> AppResult<()> {
    let genres = serde_json::to_string(&record.genre_labels()).map_err(AppError::internal)?;
    let detail = serde_json::to_string(&record.detail).map_err(AppError::internal)?;
    let poster = record.poster_key().map(|key| key.as_str().to_owned());
    conn.prepare_cached(
        "INSERT INTO titles (id, kind, title, search, year, poster, genres, anime, imdb_rating, popularity, series_id, season, episode, detail, updated_at, verified_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)
         ON CONFLICT(id) DO UPDATE SET kind = excluded.kind, title = excluded.title, search = excluded.search, year = excluded.year,
           poster = excluded.poster, genres = excluded.genres, anime = excluded.anime, imdb_rating = excluded.imdb_rating,
           popularity = excluded.popularity, series_id = excluded.series_id, season = excluded.season, episode = excluded.episode,
           detail = excluded.detail, updated_at = excluded.updated_at, verified_at = COALESCE(excluded.verified_at, titles.verified_at)",
    )?
    .execute(params![
        record.id,
        record.kind.as_str(),
        record.title,
        record.title.to_lowercase(),
        record.year,
        poster,
        genres,
        record.anime,
        record.imdb_rating,
        record.popularity,
        record.series_id(),
        record.season,
        record.episode,
        detail,
        now,
        verified_at,
    ])?;
    conn.prepare_cached("DELETE FROM title_genres WHERE title_id = ?1")?
        .execute([&record.id])?;
    let mut insert = conn.prepare_cached("INSERT INTO title_genres (title_id, genre_id, label) VALUES (?1, ?2, ?3)")?;
    for genre in &record.genres {
        insert.execute(params![record.id, genre.id, genre.label])?;
    }
    Ok(())
}

pub(crate) fn detail_fresh(conn: &Connection, id: &str, series_only: bool, metadata_ms: i64) -> AppResult<bool> {
    let row = conn
        .prepare_cached("SELECT kind, verified_at FROM titles WHERE id = ?1")?
        .query_row([id], |row| Ok((row.get::<_, String>(0)?, row.get::<_, Option<i64>>(1)?)))
        .optional()?;
    let Some((kind, Some(verified_at))) = row else { return Ok(false) };
    let age = now_ms() - verified_at;
    Ok((0..metadata_ms).contains(&age) && (!series_only || kind == "series"))
}

pub(crate) fn verified_kind(conn: &Connection, id: &str) -> AppResult<Option<MediaKind>> {
    let kind: Option<String> = conn
        .prepare_cached("SELECT kind FROM titles WHERE id = ?1 AND verified_at IS NOT NULL")?
        .query_row([id], |row| row.get(0))
        .optional()?;
    Ok(kind.as_deref().and_then(MediaKind::parse))
}

pub(crate) fn kind_of(conn: &Connection, id: &str) -> AppResult<Option<MediaKind>> {
    let kind: Option<String> = conn
        .prepare_cached("SELECT kind FROM titles WHERE id = ?1")?
        .query_row([id], |row| row.get(0))
        .optional()?;
    Ok(kind.as_deref().and_then(MediaKind::parse))
}

pub(crate) fn runtime_minutes(conn: &Connection, id: &str) -> AppResult<Option<u32>> {
    let minutes: Option<i64> = conn
        .prepare_cached(
            "SELECT COALESCE(json_extract(titles.detail, '$.minutes'), json_extract(series.detail, '$.minutes'))
             FROM titles LEFT JOIN titles AS series ON series.id = titles.series_id WHERE titles.id = ?1",
        )?
        .query_row([id], |row| row.get(0))
        .optional()?
        .flatten();
    Ok(minutes.and_then(|minutes| u32::try_from(minutes).ok()))
}

pub(crate) fn browsable_count(conn: &Connection) -> AppResult<i64> {
    Ok(conn.query_row("SELECT COUNT(*) FROM titles WHERE kind <> 'episode'", [], |row| row.get(0))?)
}
