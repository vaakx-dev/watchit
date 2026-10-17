import { writeFileSync } from 'node:fs';
import type { DatabaseSync } from 'node:sqlite';
import { hash_pin, random_pin } from './pins.ts';

export const ACCESS_TABLES = `
  CREATE TABLE IF NOT EXISTS profile_pins (
    profile_id INTEGER PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
    salt BLOB NOT NULL,
    hash BLOB NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    last_used_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS sessions_profile ON sessions(profile_id);
  CREATE TABLE IF NOT EXISTS pin_attempts (
    scope TEXT PRIMARY KEY,
    failures INTEGER NOT NULL,
    locked_until INTEGER NOT NULL
  );
`;

function has_admins(database: DatabaseSync): boolean {
  const columns = database.prepare('PRAGMA table_info(profiles)').all() as { name: string }[];
  return columns.some(column => column.name === 'is_admin');
}

function protect_dev(database: DatabaseSync, pin_file: string): void {
  const dev = database.prepare("SELECT id FROM profiles WHERE name = 'dev'").get() as { id: number } | undefined;
  if (!dev) return;
  const pin = random_pin();
  const { salt, hash } = hash_pin(pin);
  database.prepare('INSERT INTO profile_pins (profile_id, salt, hash) VALUES (?, ?, ?)').run(dev.id, salt, hash);
  writeFileSync(pin_file, `${pin}\n`);
}

export function migrate_to_admins(database: DatabaseSync, dev_pin_file: string): void {
  if (has_admins(database)) return;
  database.exec('BEGIN IMMEDIATE');
  try {
    database.exec(`ALTER TABLE profiles ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0 CHECK (is_admin IN (0, 1));
      UPDATE profiles SET is_admin = 1 WHERE name IN ('dry', 'dev') OR id = (SELECT MIN(id) FROM profiles);`);
    protect_dev(database, dev_pin_file);
    database.exec('COMMIT');
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
}
