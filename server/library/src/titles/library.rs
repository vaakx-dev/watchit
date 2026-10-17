use rusqlite::Row;
use watchit_catalog::{MediaKind, SavedPosition};

use crate::entries::PersonalEntry;
use crate::rating::Rating;
use crate::status::Status;

pub const RANKING_ORDER: &str = "rating DESC, position IS NULL, position, opened_at DESC, title COLLATE NOCASE, id";
pub const RECENT_ORDER: &str = "opened_at DESC, title COLLATE NOCASE, id";

pub const LIBRARY_TITLES: &str = "
  WITH opened AS (
    SELECT COALESCE(series_id, id) AS id, MAX(opened_at) AS opened_at
    FROM library_entries WHERE profile_id = ?1 AND opened_at IS NOT NULL GROUP BY 1
  ), members AS (
    SELECT id FROM library_entries WHERE profile_id = ?1 AND series_id IS NULL
    UNION SELECT id FROM opened
  ), lib AS (
    SELECT titles.id, titles.title, titles.year, titles.kind, titles.anime,
      e.rating, e.status, COALESCE(e.favorite, 0) AS favorite, COALESCE(e.recommended, 0) AS recommended,
      COALESCE(e.saved, 0) AS saved, e.opened_at AS last_opened_at, opened.opened_at, e.position,
      w.position_seconds, w.duration_seconds
    FROM members
    JOIN titles ON titles.id = members.id AND titles.kind <> 'episode'
    LEFT JOIN library_entries e ON e.profile_id = ?1 AND e.id = members.id
    LEFT JOIN opened ON opened.id = members.id
    LEFT JOIN watch_progress w ON w.profile_id = ?1 AND w.id = members.id
  )";

pub struct LibraryRow {
    pub id: String,
    pub kind: MediaKind,
    pub rating: Option<Rating>,
    pub status: Option<Status>,
    pub favorite: bool,
    pub recommended: bool,
    pub saved: bool,
    pub last_opened_at: Option<String>,
    pub opened_at: Option<String>,
    pub resume: Option<SavedPosition>,
}

impl LibraryRow {
    pub fn read(row: &Row<'_>) -> rusqlite::Result<Self> {
        let kind: String = row.get(3)?;
        let position: Option<f64> = row.get(13)?;
        let duration: Option<f64> = row.get(14)?;
        Ok(Self {
            id: row.get(0)?,
            kind: MediaKind::parse(&kind).unwrap_or(MediaKind::Movie),
            rating: row.get(5)?,
            status: row.get(6)?,
            favorite: row.get(7)?,
            recommended: row.get(8)?,
            saved: row.get(9)?,
            last_opened_at: row.get(10)?,
            opened_at: row.get(11)?,
            resume: position.zip(duration).map(|(position_seconds, duration_seconds)| SavedPosition { position_seconds, duration_seconds }),
        })
    }

    pub fn entry(&self) -> PersonalEntry {
        PersonalEntry {
            id: self.id.clone(),
            rating: self.rating,
            status: self.status,
            favorite: self.favorite,
            recommended: self.recommended,
            saved: self.saved,
            last_opened_at: self.last_opened_at.clone(),
        }
    }
}
