use rusqlite::Connection;
use watchit_artwork::{ImageKey, ImageSet, backdrop_url};
use watchit_core::AppResult;

use crate::clock::iso;
use crate::model::{CatalogEntry, ImageCredit, MediaKind, Title, Trailer};
use crate::store::entry::{ENTRY_COLUMNS, EntryRow};
use crate::store::record::{Record, load};

pub(crate) struct Stored {
    pub record: Record,
    pub poster: Option<ImageKey>,
    pub updated_at: i64,
}

pub(crate) fn stored(conn: &Connection, id: &str) -> AppResult<Option<Stored>> {
    let Some(record) = load(conn, id)? else { return Ok(None) };
    let updated_at: i64 = conn
        .prepare_cached("SELECT updated_at FROM titles WHERE id = ?1")?
        .query_row([id], |row| row.get(0))?;
    Ok(Some(Stored {
        poster: record.poster_key(),
        record,
        updated_at,
    }))
}

fn terms_url(source_url: &str) -> &'static str {
    if source_url.starts_with("https://m.media-amazon.com/") {
        "https://www.imdb.com/conditions"
    } else {
        "https://www.metahub.space/terms"
    }
}

fn credit(role: &'static str, source_url: &str, description_url: &str, url: String, retrieved_at: Option<String>) -> ImageCredit {
    ImageCredit {
        source: "cinemeta",
        role,
        source_url: source_url.to_owned(),
        description_url: description_url.to_owned(),
        terms_url: terms_url(source_url),
        author: "",
        license: "",
        license_url: "",
        url,
        retrieved_at,
    }
}

pub(crate) fn view(stored: &Stored, images: &ImageSet) -> Title {
    let Stored { record, poster, .. } = stored;
    let detail = &record.detail;
    let poster_url = poster.as_ref().map(|key| images.url(key)).unwrap_or_default();
    let mut credits = Vec::new();
    if let (Some(key), Some(source)) = (poster, &detail.poster) {
        let role = if record.kind == MediaKind::Episode { "still" } else { "poster" };
        let retrieved_at = images.fetched_at(key).map(iso);
        credits.push(credit(role, source, &detail.source_url, poster_url.clone(), retrieved_at));
    }
    let backdrop = match (record.kind, &detail.background) {
        (MediaKind::Episode, _) => poster_url.clone(),
        (_, Some(source)) => match backdrop_url(source) {
            Ok(url) => {
                credits.push(credit("backdrop", source, &detail.source_url, url.clone(), None));
                url
            }
            Err(_) => poster_url.clone(),
        },
        (_, None) => poster_url.clone(),
    };
    Title {
        entry: CatalogEntry {
            id: record.id.clone(),
            title: record.title.clone(),
            year: record.year,
            artwork: poster_url,
            genres: record.genre_labels(),
            kind: record.kind,
            anime: record.anime,
            imdb_rating: record.imdb_rating,
        },
        backdrop,
        minutes: detail.minutes,
        synopsis: detail.synopsis.clone(),
        director: detail.director.clone(),
        cast: detail.cast.clone(),
        imdb_id: detail.imdb_id.clone(),
        tmdb_id: detail.tmdb_id,
        season: record.season,
        episode: record.episode,
        series: detail.series.clone(),
        related: Vec::new(),
        images: credits,
        source_url: detail.source_url.clone(),
        provider_ids: None,
        popularity: record.popularity,
        trailers: detail.trailers.iter().map(|id| Trailer { id: id.clone() }).collect(),
    }
}

pub(crate) fn rows(conn: &Connection, ids: &[String]) -> AppResult<Vec<EntryRow>> {
    let list = serde_json::to_string(ids).unwrap_or_default();
    let sql = format!("SELECT {ENTRY_COLUMNS} FROM json_each(?1) AS wanted JOIN titles ON titles.id = wanted.value ORDER BY wanted.key");
    let mut statement = conn.prepare_cached(&sql)?;
    let rows = statement.query_map([list], EntryRow::read)?;
    Ok(rows.collect::<rusqlite::Result<_>>()?)
}
