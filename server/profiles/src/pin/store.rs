use axum::http::StatusCode;
use rusqlite::{Connection, OptionalExtension, params};
use watchit_core::{AppError, AppResult};

use super::hash::PinHash;
use super::types::Pin;
use crate::clock::now_ms;

pub const TABLES: &str = "
  CREATE TABLE IF NOT EXISTS profile_pins (
    profile_id INTEGER PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
    salt BLOB NOT NULL,
    hash BLOB NOT NULL
  );
  CREATE TABLE IF NOT EXISTS pin_attempts (
    scope TEXT PRIMARY KEY,
    failures INTEGER NOT NULL,
    locked_until INTEGER NOT NULL
  );
";

const FREE_ATTEMPTS: i64 = 5;
const FIRST_LOCK_MS: i64 = 30_000;
const LONGEST_LOCK_MS: i64 = 15 * 60_000;

fn profile_scope(profile: i64) -> String {
    format!("profile:{profile}")
}

fn scopes(profile: i64, client: &str) -> [String; 2] {
    [profile_scope(profile), format!("client:{client}")]
}

fn lock_ms(failures: i64) -> i64 {
    let doublings = (failures - FREE_ATTEMPTS).clamp(0, 16) as u32;
    (FIRST_LOCK_MS * 2_i64.pow(doublings)).min(LONGEST_LOCK_MS)
}

fn locked(until: i64, now: i64) -> AppError {
    let seconds = (until - now + 999) / 1000;
    AppError::new(
        StatusCode::TOO_MANY_REQUESTS,
        format!("Too many wrong PINs. Try again in {seconds} seconds."),
    )
    .retry_after(seconds as u64)
}

fn stored(conn: &Connection, profile: i64) -> AppResult<Option<PinHash>> {
    let mut query = conn.prepare_cached("SELECT salt, hash FROM profile_pins WHERE profile_id = ?")?;
    Ok(query
        .query_row([profile], |row| {
            Ok(PinHash {
                salt: row.get(0)?,
                hash: row.get(1)?,
            })
        })
        .optional()?)
}

fn locked_until(conn: &Connection, scope: &str) -> AppResult<i64> {
    let mut query = conn.prepare_cached("SELECT locked_until FROM pin_attempts WHERE scope = ?")?;
    Ok(query.query_row([scope], |row| row.get(0)).optional()?.unwrap_or(0))
}

fn fail(conn: &Connection, scope: &str, now: i64) -> AppResult<i64> {
    let failures: i64 = conn.query_row(
        "INSERT INTO pin_attempts (scope, failures, locked_until) VALUES (?, 1, 0)
          ON CONFLICT(scope) DO UPDATE SET failures = failures + 1 RETURNING failures",
        [scope],
        |row| row.get(0),
    )?;
    if failures >= FREE_ATTEMPTS {
        conn.execute(
            "UPDATE pin_attempts SET locked_until = ? WHERE scope = ?",
            params![now + lock_ms(failures), scope],
        )?;
    }
    Ok(failures)
}

fn clear(conn: &Connection, scope: &str) -> AppResult<()> {
    conn.execute("DELETE FROM pin_attempts WHERE scope = ?", [scope])?;
    Ok(())
}

pub fn check(conn: &Connection, profile: i64, pin: Option<&Pin>, client: &str) -> AppResult<()> {
    let Some(stored) = stored(conn, profile)? else { return Ok(()) };
    let Some(pin) = pin else {
        return Err(AppError::forbidden("This profile has a PIN. Enter it to continue."));
    };
    let now = now_ms();
    let scopes = scopes(profile, client);
    let mut until = 0;
    for scope in &scopes {
        until = until.max(locked_until(conn, scope)?);
    }
    if until > now {
        return Err(locked(until, now));
    }
    if stored.matches(pin) {
        return scopes.iter().try_for_each(|scope| clear(conn, scope));
    }
    let mut failures = 0;
    for scope in &scopes {
        failures = failures.max(fail(conn, scope, now)?);
    }
    if failures >= FREE_ATTEMPTS {
        return Err(locked(now + lock_ms(failures), now));
    }
    let left = FREE_ATTEMPTS - failures;
    Err(AppError::forbidden(format!(
        "Wrong PIN. {left} {} left before a pause.",
        if left == 1 { "try" } else { "tries" }
    )))
}

pub fn set(conn: &Connection, profile: i64, pin: Option<&Pin>) -> AppResult<()> {
    match pin {
        Some(pin) => {
            let PinHash { salt, hash } = PinHash::new(pin);
            conn.execute(
                "INSERT INTO profile_pins (profile_id, salt, hash) VALUES (?, ?, ?)
                  ON CONFLICT(profile_id) DO UPDATE SET salt = excluded.salt, hash = excluded.hash",
                params![profile, salt, hash],
            )?;
        }
        None => {
            conn.execute("DELETE FROM profile_pins WHERE profile_id = ?", [profile])?;
        }
    }
    forget(conn, profile)
}

pub fn forget(conn: &Connection, profile: i64) -> AppResult<()> {
    clear(conn, &profile_scope(profile))
}
