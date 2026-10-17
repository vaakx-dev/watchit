use std::path::Path;

use rusqlite::{Connection, params};
use watchit_core::{AppError, AppResult};

use super::export::{ExportAvatar, ExportProfile, Marked};
use crate::rating::Rating;
use crate::status::Status;

fn decode(hex_text: &str) -> AppResult<Vec<u8>> {
    hex::decode(hex_text).map_err(AppError::internal)
}

fn rating(stars: f64) -> AppResult<Rating> {
    Rating::from_stars(stars).ok_or_else(|| AppError::internal(format!("{stars} is not a half-star rating")))
}

pub fn profile(conn: &Connection, folder: &Path, profile: &ExportProfile) -> AppResult<()> {
    let (seed, image) = match &profile.avatar {
        ExportAvatar::Eyes { seed } => (*seed, None),
        ExportAvatar::Image { file, updated_at_ms, eye_seed } => (*eye_seed, Some((std::fs::read(folder.join(file))?, *updated_at_ms))),
    };
    conn.execute(
        "INSERT INTO profiles (id, name, created_at, is_admin, avatar_seed) VALUES (?1, ?2, ?3, ?4, ?5)",
        params![profile.old_id, profile.name, profile.created_at, profile.is_admin, seed],
    )?;
    if let Some(pin) = &profile.pin {
        conn.execute(
            "INSERT INTO profile_pins (profile_id, salt, hash) VALUES (?1, ?2, ?3)",
            params![profile.old_id, decode(&pin.salt_hex)?, decode(&pin.hash_hex)?],
        )?;
    }
    if let Some((bytes, updated_at)) = image {
        conn.execute("INSERT INTO profile_avatars (profile_id, image, updated_at) VALUES (?1, ?2, ?3)", params![profile.old_id, bytes, updated_at])?;
    }
    Ok(())
}

fn entry(conn: &Connection, profile: i64, mark: &Marked) -> AppResult<()> {
    let rating = mark.rating.map(rating).transpose()?;
    let status = mark
        .status
        .as_deref()
        .map(|text| Status::parse(text).ok_or_else(|| AppError::internal(format!("unknown status {text}"))))
        .transpose()?;
    conn.execute(
        "INSERT INTO library_entries (profile_id, id, series_id, rating, status, favorite, recommended, saved, opened_at, position)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
        params![profile, mark.id, mark.series_id, rating, status, mark.favorite, mark.recommended, mark.saved, mark.last_opened_at, mark.ranking_position],
    )?;
    Ok(())
}

pub fn library(conn: &Connection, data: &ExportProfile) -> AppResult<()> {
    let id = data.old_id;
    for mark in data.titles.iter().chain(&data.episodes).filter(|mark| !mark.is_empty()) {
        entry(conn, id, mark)?;
    }
    for season in &data.season_ratings {
        conn.execute(
            "INSERT INTO season_ratings (profile_id, series_id, season, rating) VALUES (?1, ?2, ?3, ?4)",
            params![id, season.series_id, season.season, rating(season.rating)?],
        )?;
    }
    for source in &data.playback_sources {
        conn.execute("INSERT INTO playback_sources (profile_id, id, source) VALUES (?1, ?2, ?3)", params![id, source.id, source.source])?;
    }
    Ok(())
}
