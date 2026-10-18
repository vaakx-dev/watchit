use rusqlite::{Connection, OptionalExtension, params};
use watchit_core::AppResult;

use crate::clock::now_ms;

pub const TABLE: &str = "
  CREATE TABLE IF NOT EXISTS profile_avatars (
    profile_id INTEGER PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
    image BLOB NOT NULL,
    updated_at INTEGER NOT NULL
  );
";

pub struct AvatarImage {
    pub image: Vec<u8>,
    pub updated_at: i64,
}

pub fn get(conn: &Connection, profile: i64) -> AppResult<Option<AvatarImage>> {
    let mut query = conn.prepare_cached("SELECT image, updated_at FROM profile_avatars WHERE profile_id = ?")?;
    Ok(query
        .query_row([profile], |row| {
            Ok(AvatarImage {
                image: row.get(0)?,
                updated_at: row.get(1)?,
            })
        })
        .optional()?)
}

pub fn put(conn: &Connection, profile: i64, image: &[u8]) -> AppResult<()> {
    conn.execute(
        "INSERT INTO profile_avatars (profile_id, image, updated_at) VALUES (?, ?, ?)
          ON CONFLICT(profile_id) DO UPDATE SET image = excluded.image, updated_at = excluded.updated_at",
        params![profile, image, now_ms()],
    )?;
    Ok(())
}

pub fn delete(conn: &Connection, profile: i64) -> AppResult<()> {
    conn.execute("DELETE FROM profile_avatars WHERE profile_id = ?", [profile])?;
    Ok(())
}

pub fn shuffle(conn: &Connection, profile: i64) -> AppResult<()> {
    let seed = rand::random_range(1..1_i64 << 31);
    conn.execute("UPDATE profiles SET avatar_seed = ? WHERE id = ?", params![seed, profile])?;
    Ok(())
}
