use std::collections::HashSet;

use rusqlite::{Connection, params};
use watchit_core::AppResult;

use crate::model::MediaKind;
use crate::store::entry::{ENTRY_COLUMNS, ENTRY_WIDTH, EntryRow};
use crate::store::record::Record;

const CANDIDATES: i64 = 400;
const SIMILAR: usize = 12;

fn people(values: &[&str]) -> HashSet<String> {
    values
        .iter()
        .flat_map(|value| value.split(','))
        .map(|name| name.trim().to_lowercase())
        .filter(|name| !name.is_empty())
        .collect()
}

fn score(title: &Record, genres: &HashSet<&str>, crew: &HashSet<String>, row: &EntryRow, candidate_crew: &HashSet<String>) -> f64 {
    let shared_genres = row.genres.iter().filter(|genre| genres.contains(genre.as_str())).count() as f64;
    let shared_people = candidate_crew.intersection(crew).count() as f64;
    let years = match (title.year, row.year) {
        (Some(left), Some(right)) => (1.0 - (left - right).abs() as f64 / 25.0).max(0.0),
        _ => 0.0,
    };
    let anime = if row.anime == title.anime { 0.5 } else { 0.0 };
    shared_genres * 2.0 + shared_people * 1.5 + years + row.imdb_rating.unwrap_or(5.0) / 5.0 + anime
}

pub(crate) fn similar(conn: &Connection, title: &Record, exclude: &[String], settled: &HashSet<String>) -> AppResult<Vec<EntryRow>> {
    if title.genres.is_empty() || title.kind == MediaKind::Episode {
        return Ok(Vec::new());
    }
    let ids: Vec<&str> = title.genres.iter().map(|genre| genre.id.as_str()).collect();
    let sql = format!(
        "SELECT {ENTRY_COLUMNS}, json_extract(titles.detail, '$.director'), json_extract(titles.detail, '$.cast')
         FROM (SELECT title_id, COUNT(*) AS shared FROM title_genres WHERE genre_id IN (SELECT value FROM json_each(?1))
               GROUP BY title_id HAVING COUNT(*) >= ?2) AS matches
         JOIN titles ON titles.id = matches.title_id
         WHERE titles.kind = ?3
         ORDER BY matches.shared DESC, titles.imdb_rating DESC NULLS LAST, titles.id
         LIMIT ?4"
    );
    let mut statement = conn.prepare_cached(&sql)?;
    let candidates = statement.query_map(
        params![
            serde_json::to_string(&ids).unwrap_or_default(),
            ids.len().min(2) as i64,
            title.kind.as_str(),
            CANDIDATES
        ],
        |row| {
            let director: Option<String> = row.get(ENTRY_WIDTH)?;
            let cast: Option<String> = row.get(ENTRY_WIDTH + 1)?;
            Ok((
                EntryRow::read(row)?,
                people(&[director.as_deref().unwrap_or(""), cast.as_deref().unwrap_or("")]),
            ))
        },
    )?;
    let skipped: HashSet<&str> = exclude.iter().map(String::as_str).chain([title.id.as_str()]).collect();
    let genres: HashSet<&str> = title.genres.iter().map(|genre| genre.label.as_str()).collect();
    let crew = people(&[&title.detail.director, &title.detail.cast]);
    let mut ranked = Vec::new();
    for candidate in candidates {
        let (row, candidate_crew) = candidate?;
        if skipped.contains(row.id.as_str()) {
            continue;
        }
        let score = score(title, &genres, &crew, &row, &candidate_crew);
        ranked.push((settled.contains(&row.id), score, row));
    }
    ranked.sort_by(|left, right| {
        left.0
            .cmp(&right.0)
            .then(right.1.total_cmp(&left.1))
            .then_with(|| left.2.id.cmp(&right.2.id))
    });
    Ok(ranked.into_iter().take(SIMILAR).map(|(_, _, row)| row).collect())
}
