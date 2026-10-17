use rusqlite::Connection;
use watchit_core::AppResult;

pub(crate) const TOP_RATED_ORDER: &str =
    "(imdb_rating IS NOT NULL AND COALESCE(popularity, 0) >= 0.2) DESC, imdb_rating DESC, year DESC, title COLLATE NOCASE, id";
const BROWSE_ORDER: &str = "year DESC, title COLLATE NOCASE, id";

pub(crate) fn create(conn: &Connection) -> AppResult<()> {
    conn.execute_batch(&format!(
        "CREATE TABLE IF NOT EXISTS titles (
            id TEXT PRIMARY KEY,
            kind TEXT NOT NULL CHECK (kind IN ('movie', 'series', 'episode')),
            title TEXT NOT NULL,
            search TEXT NOT NULL,
            year INTEGER,
            poster TEXT,
            genres TEXT NOT NULL,
            anime INTEGER NOT NULL CHECK (anime IN (0, 1)),
            imdb_rating REAL,
            popularity REAL,
            trending_rank INTEGER,
            anime_rank INTEGER,
            series_id TEXT,
            season INTEGER,
            episode INTEGER,
            detail TEXT NOT NULL,
            updated_at INTEGER NOT NULL,
            verified_at INTEGER
        );
        CREATE TABLE IF NOT EXISTS title_genres (
            title_id TEXT NOT NULL REFERENCES titles(id) ON DELETE CASCADE,
            genre_id TEXT NOT NULL,
            label TEXT NOT NULL,
            PRIMARY KEY (title_id, genre_id)
        ) WITHOUT ROWID;
        CREATE TABLE IF NOT EXISTS trending (
            kind TEXT NOT NULL CHECK (kind IN ('movie', 'series', 'anime')),
            day TEXT NOT NULL,
            rank INTEGER NOT NULL CHECK (rank >= 1),
            id TEXT NOT NULL REFERENCES titles(id) ON DELETE CASCADE,
            PRIMARY KEY (kind, day, rank)
        ) WITHOUT ROWID;
        CREATE TABLE IF NOT EXISTS import_jobs (key TEXT PRIMARY KEY, state TEXT NOT NULL) WITHOUT ROWID;
        CREATE TABLE IF NOT EXISTS franchises (
            imdb_id TEXT PRIMARY KEY,
            name TEXT,
            ids TEXT NOT NULL,
            failed INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        ) WITHOUT ROWID;
        CREATE TABLE IF NOT EXISTS catalog_settings (key TEXT PRIMARY KEY, value REAL NOT NULL);
        CREATE INDEX IF NOT EXISTS titles_browse_year ON titles({BROWSE_ORDER}) WHERE kind <> 'episode';
        CREATE INDEX IF NOT EXISTS titles_browse_title ON titles(title COLLATE NOCASE, id) WHERE kind <> 'episode';
        CREATE INDEX IF NOT EXISTS titles_kind_year ON titles(kind, {BROWSE_ORDER});
        CREATE INDEX IF NOT EXISTS titles_kind_title ON titles(kind, title COLLATE NOCASE, id);
        CREATE INDEX IF NOT EXISTS titles_anime_year ON titles(anime, {BROWSE_ORDER}) WHERE kind <> 'episode';
        CREATE INDEX IF NOT EXISTS titles_anime_title ON titles(anime, title COLLATE NOCASE, id) WHERE kind <> 'episode';
        CREATE INDEX IF NOT EXISTS titles_top_rated ON titles({TOP_RATED_ORDER}) WHERE kind <> 'episode';
        CREATE INDEX IF NOT EXISTS titles_kind_top_rated ON titles(kind, {TOP_RATED_ORDER});
        CREATE INDEX IF NOT EXISTS titles_anime_top_rated ON titles(anime, {TOP_RATED_ORDER}) WHERE kind <> 'episode';
        CREATE INDEX IF NOT EXISTS titles_browse_trending ON titles(trending_rank, {BROWSE_ORDER}) WHERE kind <> 'episode';
        CREATE INDEX IF NOT EXISTS titles_kind_trending ON titles(kind, trending_rank, {BROWSE_ORDER});
        CREATE INDEX IF NOT EXISTS titles_anime_trending ON titles(anime, anime_rank, {BROWSE_ORDER}) WHERE kind <> 'episode';
        CREATE INDEX IF NOT EXISTS titles_series ON titles(series_id, season, episode, id) WHERE series_id IS NOT NULL;
        CREATE INDEX IF NOT EXISTS title_genres_genre ON title_genres(genre_id, title_id);
        CREATE INDEX IF NOT EXISTS trending_title ON trending(id, kind, day);"
    ))?;
    Ok(())
}
