use rusqlite::Connection;
use watchit_core::AppResult;

use super::export::ExportProfile;

#[derive(Debug, Default, PartialEq, Eq)]
pub struct Counts {
    pub entries: i64,
    pub rated: i64,
    pub want: i64,
    pub watching: i64,
    pub paused: i64,
    pub watched: i64,
    pub dropped: i64,
    pub favorite: i64,
    pub recommended: i64,
    pub saved: i64,
    pub opened: i64,
    pub placed: i64,
    pub season_ratings: i64,
    pub playback_sources: i64,
}

fn tally(flag: bool) -> i64 {
    i64::from(flag)
}

pub fn expected(profile: &ExportProfile) -> Counts {
    let mut counts = Counts {
        season_ratings: profile.season_ratings.len() as i64,
        playback_sources: profile.playback_sources.len() as i64,
        ..Counts::default()
    };
    for mark in profile.titles.iter().chain(&profile.episodes).filter(|mark| !mark.is_empty()) {
        counts.entries += 1;
        counts.rated += tally(mark.rating.is_some());
        counts.favorite += tally(mark.favorite);
        counts.recommended += tally(mark.recommended);
        counts.saved += tally(mark.saved);
        counts.opened += tally(mark.last_opened_at.is_some());
        counts.placed += tally(mark.ranking_position.is_some());
        match mark.status.as_deref() {
            Some("want") => counts.want += 1,
            Some("watching") => counts.watching += 1,
            Some("paused") => counts.paused += 1,
            Some("watched") => counts.watched += 1,
            Some("dropped") => counts.dropped += 1,
            _ => {}
        }
    }
    counts
}

pub fn stored(conn: &Connection, profile: i64) -> AppResult<Counts> {
    let mut counts = conn.query_row(
        "SELECT COUNT(*), COUNT(rating), COUNT(*) FILTER (WHERE status = 'want'), COUNT(*) FILTER (WHERE status = 'watching'),
           COUNT(*) FILTER (WHERE status = 'paused'), COUNT(*) FILTER (WHERE status = 'watched'), COUNT(*) FILTER (WHERE status = 'dropped'),
           COUNT(*) FILTER (WHERE favorite = 1), COUNT(*) FILTER (WHERE recommended = 1), COUNT(*) FILTER (WHERE saved = 1),
           COUNT(opened_at), COUNT(position)
         FROM library_entries WHERE profile_id = ?1",
        [profile],
        |row| {
            Ok(Counts {
                entries: row.get(0)?,
                rated: row.get(1)?,
                want: row.get(2)?,
                watching: row.get(3)?,
                paused: row.get(4)?,
                watched: row.get(5)?,
                dropped: row.get(6)?,
                favorite: row.get(7)?,
                recommended: row.get(8)?,
                saved: row.get(9)?,
                opened: row.get(10)?,
                placed: row.get(11)?,
                ..Counts::default()
            })
        },
    )?;
    counts.season_ratings = conn.query_row("SELECT COUNT(*) FROM season_ratings WHERE profile_id = ?1", [profile], |row| row.get(0))?;
    counts.playback_sources = conn.query_row("SELECT COUNT(*) FROM playback_sources WHERE profile_id = ?1", [profile], |row| row.get(0))?;
    Ok(counts)
}
