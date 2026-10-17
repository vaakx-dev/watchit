use std::collections::HashMap;
use std::sync::Mutex;

use rusqlite::Connection;
use rusqlite::types::Value;
use watchit_artwork::Artwork;
use watchit_core::AppResult;

use crate::genres::{GenreOption, is_minor};
use crate::model::{CatalogKind, CatalogPage, CatalogSort};
use crate::store::entry::{ENTRY_COLUMNS, PAGE_SIZE, freshness, images, offset, page_rows};
use crate::store::schema::TOP_RATED_ORDER;

#[derive(Clone, Debug)]
pub struct BrowseQuery {
    pub page: u32,
    pub query: String,
    pub kind: CatalogKind,
    pub genre: String,
    pub sort: CatalogSort,
}

#[derive(Clone, Debug)]
pub enum IdFilter {
    Exclude(Vec<String>),
    Include(Vec<String>),
}

impl IdFilter {
    pub(crate) fn condition(&self, parameters: &mut Vec<Value>) -> &'static str {
        let ids = match self {
            Self::Exclude(ids) | Self::Include(ids) => ids,
        };
        parameters.push(Value::Text(serde_json::to_string(ids).unwrap_or_default()));
        match self {
            Self::Exclude(_) => "titles.id NOT IN (SELECT value FROM json_each(?))",
            Self::Include(_) => "titles.id IN (SELECT value FROM json_each(?))",
        }
    }
}

#[derive(Default)]
pub(crate) struct Facets {
    cache: Mutex<HashMap<(CatalogKind, String), Vec<GenreOption>>>,
}

impl Facets {
    pub fn clear(&self) {
        self.cache.lock().unwrap().clear();
    }
}

pub(crate) fn kind_condition(kind: CatalogKind) -> &'static str {
    match kind {
        CatalogKind::All => "titles.kind <> 'episode'",
        CatalogKind::Movie => "titles.kind = 'movie'",
        CatalogKind::Series => "titles.kind = 'series'",
        CatalogKind::Anime => "titles.kind <> 'episode' AND titles.anime = 1",
    }
}

pub(crate) fn trending_column(kind: CatalogKind) -> &'static str {
    if kind == CatalogKind::Anime { "anime_rank" } else { "trending_rank" }
}

fn order(query: &BrowseQuery) -> String {
    match query.sort {
        CatalogSort::Title => "title COLLATE NOCASE, id".into(),
        CatalogSort::TopRated => TOP_RATED_ORDER.into(),
        CatalogSort::Trending => format!("{} NULLS LAST, year DESC, title COLLATE NOCASE, id", trending_column(query.kind)),
        CatalogSort::Newest => "year DESC, title COLLATE NOCASE, id".into(),
    }
}

fn search_pattern(query: &str) -> String {
    let mut pattern = String::from("%");
    for char in query.to_lowercase().chars() {
        if matches!(char, '\\' | '%' | '_') {
            pattern.push('\\');
        }
        pattern.push(char);
    }
    pattern.push('%');
    pattern
}

fn genre_options(conn: &Connection, facets: &Facets, query: &BrowseQuery, conditions: &[&str], parameters: &[Value]) -> AppResult<Vec<GenreOption>> {
    let facet = (query.kind, query.query.clone());
    if let Some(options) = facets.cache.lock().unwrap().get(&facet) {
        return Ok(options.clone());
    }
    let sql = format!(
        "SELECT title_genres.genre_id, MIN(title_genres.label) FROM title_genres JOIN titles ON titles.id = title_genres.title_id
         WHERE {} GROUP BY title_genres.genre_id",
        conditions.join(" AND ")
    );
    let mut statement = conn.prepare_cached(&sql)?;
    let rows = statement.query_map(rusqlite::params_from_iter(parameters), |row| {
        let id: String = row.get(0)?;
        Ok(GenreOption { minor: is_minor(&id), id, label: row.get(1)? })
    })?;
    let mut options: Vec<GenreOption> = rows.collect::<rusqlite::Result<_>>()?;
    options.sort_by_cached_key(|option| option.label.to_lowercase());
    facets.cache.lock().unwrap().insert(facet, options.clone());
    Ok(options)
}

pub(crate) fn browse(
    conn: &Connection,
    artwork: &Artwork,
    facets: &Facets,
    query: &BrowseQuery,
    filter: Option<&IdFilter>,
    metadata_ms: i64,
) -> AppResult<CatalogPage> {
    let mut conditions = vec![kind_condition(query.kind)];
    let mut parameters = Vec::new();
    if !query.query.is_empty() {
        conditions.push("titles.search LIKE ? ESCAPE '\\'");
        parameters.push(Value::Text(search_pattern(&query.query)));
    }
    let genres = genre_options(conn, facets, query, &conditions, &parameters)?;
    if !query.genre.is_empty() {
        conditions.push("titles.id IN (SELECT title_id FROM title_genres WHERE genre_id = ?)");
        parameters.push(Value::Text(query.genre.clone()));
    }
    if let Some(filter) = filter {
        conditions.push(filter.condition(&mut parameters));
    }
    parameters.push(Value::Integer(PAGE_SIZE as i64 + 1));
    parameters.push(Value::Integer(offset(query.page)));
    let sql = format!("SELECT {ENTRY_COLUMNS} FROM titles WHERE {} ORDER BY {} LIMIT ? OFFSET ?", conditions.join(" AND "), order(query));
    let (rows, has_next) = page_rows(&mut *conn.prepare_cached(&sql)?, rusqlite::params_from_iter(parameters))?;
    let images = images(conn, artwork, &rows)?;
    Ok(CatalogPage {
        items: rows.iter().map(|row| row.entry(&images)).collect(),
        page: query.page,
        has_next,
        genres,
        freshness: freshness(&rows, metadata_ms),
        artwork_status: images.status,
    })
}
