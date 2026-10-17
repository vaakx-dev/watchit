use chrono::{SecondsFormat, Utc};
use rusqlite::{Connection, OptionalExtension, Row, TransactionBehavior, params};
use watchit_core::{AppError, AppResult, Viewer};

use super::types::{Avatar, Profile, ProfilePatch};
use crate::pin;

pub const TABLE: &str = "
  CREATE TABLE IF NOT EXISTS profiles (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE COLLATE NOCASE,
    created_at TEXT NOT NULL,
    is_admin INTEGER NOT NULL DEFAULT 0 CHECK (is_admin IN (0, 1)),
    avatar_seed INTEGER NOT NULL DEFAULT 0
  );
";

pub const NAME_LIMIT: usize = 24;

const COLUMNS: &str = "id, name, created_at, is_admin, avatar_seed,
  EXISTS (SELECT 1 FROM profile_pins WHERE profile_id = profiles.id) AS has_pin,
  (SELECT updated_at FROM profile_avatars WHERE profile_id = profiles.id) AS avatar_version";

fn avatar(id: i64, seed: i64, version: Option<i64>) -> Avatar {
    match version {
        Some(version) => Avatar::Image { url: format!("/api/profiles/{id}/avatar?v={version}") },
        None => Avatar::Eyes { seed },
    }
}

fn from_row(row: &Row) -> rusqlite::Result<Profile> {
    let id = row.get("id")?;
    Ok(Profile {
        id,
        name: row.get("name")?,
        created_at: row.get("created_at")?,
        is_admin: row.get("is_admin")?,
        has_pin: row.get("has_pin")?,
        avatar: avatar(id, row.get("avatar_seed")?, row.get("avatar_version")?),
    })
}

pub fn list(conn: &Connection) -> AppResult<Vec<Profile>> {
    let mut query = conn.prepare_cached(&format!("SELECT {COLUMNS} FROM profiles ORDER BY id"))?;
    let profiles = query.query_map([], from_row)?.collect::<rusqlite::Result<_>>()?;
    Ok(profiles)
}

pub fn get(conn: &Connection, id: i64) -> AppResult<Option<Profile>> {
    let mut query = conn.prepare_cached(&format!("SELECT {COLUMNS} FROM profiles WHERE id = ?"))?;
    Ok(query.query_row([id], from_row).optional()?)
}

pub fn existing(conn: &Connection, id: i64) -> AppResult<Profile> {
    get(conn, id)?.ok_or_else(|| AppError::not_found("Profile not found."))
}

pub fn viewer(conn: &Connection, id: i64) -> AppResult<Option<Viewer>> {
    let mut query = conn.prepare_cached("SELECT is_admin FROM profiles WHERE id = ?")?;
    Ok(query.query_row([id], |row| Ok(Viewer { profile: id, admin: row.get(0)? })).optional()?)
}

fn available_name(conn: &Connection, name: &str, except: Option<i64>) -> AppResult<String> {
    let trimmed = name.trim();
    let length = trimmed.chars().count();
    if !(1..=NAME_LIMIT).contains(&length) || trimmed.chars().any(char::is_control) {
        return Err(AppError::bad_request(format!("Profile names are 1 to {NAME_LIMIT} characters.")));
    }
    let wanted = trimmed.to_lowercase();
    let taken = list(conn)?.into_iter().find(|profile| Some(profile.id) != except && profile.name.to_lowercase() == wanted);
    match taken {
        Some(profile) => Err(AppError::bad_request(format!("A profile named \"{}\" already exists.", profile.name))),
        None => Ok(trimmed.to_owned()),
    }
}

fn only_admin(conn: &Connection, profile: &Profile) -> AppResult<bool> {
    Ok(profile.is_admin && list(conn)?.iter().filter(|other| other.is_admin).count() == 1)
}

pub fn create(conn: &mut Connection, name: &str) -> AppResult<Profile> {
    let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
    let first = list(&tx)?.is_empty();
    let name = available_name(&tx, name, None)?;
    let created_at = Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true);
    tx.execute("INSERT INTO profiles (name, created_at, is_admin) VALUES (?, ?, ?)", params![name, created_at, first])?;
    let profile = existing(&tx, tx.last_insert_rowid())?;
    tx.commit()?;
    Ok(profile)
}

pub fn update(conn: &mut Connection, id: i64, patch: &ProfilePatch) -> AppResult<Profile> {
    let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
    let profile = existing(&tx, id)?;
    if let Some(name) = &patch.name {
        tx.execute("UPDATE profiles SET name = ? WHERE id = ?", params![available_name(&tx, name, Some(id))?, id])?;
    }
    if patch.is_admin == Some(false) && only_admin(&tx, &profile)? {
        return Err(AppError::bad_request("Make another profile an admin first. There must always be one."));
    }
    if let Some(admin) = patch.is_admin {
        tx.execute("UPDATE profiles SET is_admin = ? WHERE id = ?", params![admin, id])?;
    }
    let profile = existing(&tx, id)?;
    tx.commit()?;
    Ok(profile)
}

pub fn delete(conn: &mut Connection, id: i64, confirm: &str) -> AppResult<Vec<Profile>> {
    let tx = conn.transaction_with_behavior(TransactionBehavior::Immediate)?;
    let profile = existing(&tx, id)?;
    if confirm != profile.name {
        return Err(AppError::bad_request(format!("Confirm by sending the profile name \"{}\".", profile.name)));
    }
    if list(&tx)?.len() == 1 {
        return Err(AppError::bad_request("The last profile cannot be deleted."));
    }
    if only_admin(&tx, &profile)? {
        return Err(AppError::bad_request("The only admin cannot be deleted. Make another profile an admin first."));
    }
    tx.execute("DELETE FROM profiles WHERE id = ?", [id])?;
    pin::forget(&tx, id)?;
    let profiles = list(&tx)?;
    tx.commit()?;
    Ok(profiles)
}
