use rusqlite::{Connection, params};
use watchit_core::AppResult;

use super::types::ShelfCounts;
use watchit_catalog::CatalogKind;

use crate::query::{PAGE_SIZE, kind_condition, offset};
use crate::status::Status;
use crate::titles::{ADDED_ORDER, LIBRARY_TITLES, LibraryRow, RANKING_ORDER, RECENT_ORDER};

#[derive(Clone, Copy, Debug)]
pub enum Shelf {
    Status(Status),
    Favorite,
    Recommended,
    Saved,
    Recent,
}

impl Shelf {
    pub fn parse(value: &str) -> Option<Self> {
        match value {
            "favorite" => Some(Self::Favorite),
            "recommended" => Some(Self::Recommended),
            "saved" => Some(Self::Saved),
            "recent" => Some(Self::Recent),
            other => Status::parse(other).map(Self::Status),
        }
    }

    fn condition(self) -> String {
        match self {
            Self::Status(status) => format!("status = '{}'", status.as_str()),
            Self::Favorite => "favorite = 1".into(),
            Self::Recommended => "recommended = 1".into(),
            Self::Saved => "saved = 1".into(),
            Self::Recent => "opened_at IS NOT NULL".into(),
        }
    }

    pub fn total(self, counts: &ShelfCounts) -> i64 {
        match self {
            Self::Status(Status::Want) => counts.want,
            Self::Status(Status::Watching) => counts.watching,
            Self::Status(Status::Paused) => counts.paused,
            Self::Status(Status::Watched) => counts.watched,
            Self::Status(Status::Dropped) => counts.dropped,
            Self::Favorite => counts.favorite,
            Self::Recommended => counts.recommended,
            Self::Saved => counts.saved,
            Self::Recent => counts.recent,
        }
    }
}

#[derive(Clone, Copy, Debug)]
pub enum LibrarySort {
    Recent,
    Added,
    Title,
    Newest,
    Rating,
}

impl LibrarySort {
    pub fn parse(value: &str) -> Option<Self> {
        match value {
            "recent" => Some(Self::Recent),
            "added" => Some(Self::Added),
            "title" => Some(Self::Title),
            "newest" => Some(Self::Newest),
            "rating" => Some(Self::Rating),
            _ => None,
        }
    }

    fn order(self) -> &'static str {
        match self {
            Self::Recent => RECENT_ORDER,
            Self::Added => ADDED_ORDER,
            Self::Title => "title COLLATE NOCASE, id",
            Self::Newest => "year DESC, title COLLATE NOCASE, id",
            Self::Rating => RANKING_ORDER,
        }
    }
}

pub fn counts(conn: &Connection, profile: i64, kind: CatalogKind) -> AppResult<ShelfCounts> {
    let sql = format!(
        "{LIBRARY_TITLES} SELECT
           COUNT(*) FILTER (WHERE status = 'want'), COUNT(*) FILTER (WHERE status = 'watching'),
           COUNT(*) FILTER (WHERE status = 'paused'), COUNT(*) FILTER (WHERE status = 'watched'),
           COUNT(*) FILTER (WHERE status = 'dropped'), COUNT(*) FILTER (WHERE favorite = 1),
           COUNT(*) FILTER (WHERE recommended = 1), COUNT(*) FILTER (WHERE saved = 1),
           COUNT(*) FILTER (WHERE opened_at IS NOT NULL)
         FROM lib WHERE {}",
        kind_condition(kind)
    );
    let counts = conn.prepare_cached(&sql)?.query_row([profile], |row| {
        Ok(ShelfCounts {
            want: row.get(0)?,
            watching: row.get(1)?,
            paused: row.get(2)?,
            watched: row.get(3)?,
            dropped: row.get(4)?,
            favorite: row.get(5)?,
            recommended: row.get(6)?,
            saved: row.get(7)?,
            recent: row.get(8)?,
        })
    })?;
    Ok(counts)
}

pub fn page(conn: &Connection, profile: i64, condition: &str, kind: CatalogKind, order: &str, number: u32) -> AppResult<(Vec<LibraryRow>, bool)> {
    let sql = format!(
        "{LIBRARY_TITLES} SELECT * FROM lib WHERE {condition} AND {} ORDER BY {order} LIMIT ?2 OFFSET ?3",
        kind_condition(kind)
    );
    let mut rows: Vec<LibraryRow> = conn
        .prepare_cached(&sql)?
        .query_map(params![profile, PAGE_SIZE as i64 + 1, offset(number)], LibraryRow::read)?
        .collect::<rusqlite::Result<_>>()?;
    let has_next = rows.len() > PAGE_SIZE;
    rows.truncate(PAGE_SIZE);
    Ok((rows, has_next))
}

pub fn shelf_page(conn: &Connection, profile: i64, shelf: Shelf, kind: CatalogKind, sort: LibrarySort, number: u32) -> AppResult<(Vec<LibraryRow>, bool)> {
    page(conn, profile, &shelf.condition(), kind, sort.order(), number)
}

pub fn continue_page(conn: &Connection, profile: i64, kind: CatalogKind, number: u32) -> AppResult<(Vec<LibraryRow>, bool)> {
    page(conn, profile, "status IN ('watching', 'paused')", kind, RECENT_ORDER, number)
}
