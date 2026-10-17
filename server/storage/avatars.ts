import { randomInt } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import type { AvatarImage } from './types.ts';

export const AVATAR_TABLES = `
  CREATE TABLE IF NOT EXISTS profile_avatars (
    profile_id INTEGER PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
    image BLOB NOT NULL,
    updated_at INTEGER NOT NULL
  );
`;

export function add_avatar_seeds(database: DatabaseSync): void {
  const columns = database.prepare('PRAGMA table_info(profiles)').all() as { name: string }[];
  if (columns.some(column => column.name === 'avatar_seed')) return;
  database.exec('ALTER TABLE profiles ADD COLUMN avatar_seed INTEGER NOT NULL DEFAULT 0');
}

export function create_avatars(database: DatabaseSync) {
  const queries = {
    get: database.prepare('SELECT image, updated_at FROM profile_avatars WHERE profile_id = ?'),
    put: database.prepare(`INSERT INTO profile_avatars (profile_id, image, updated_at) VALUES (?, ?, ?)
      ON CONFLICT(profile_id) DO UPDATE SET image = excluded.image, updated_at = excluded.updated_at`),
    delete: database.prepare('DELETE FROM profile_avatars WHERE profile_id = ?'),
    shuffle: database.prepare('UPDATE profiles SET avatar_seed = ? WHERE id = ?'),
  };

  return {
    avatar_get(profile: number): AvatarImage | null {
      return (queries.get.get(profile) as AvatarImage | undefined) ?? null;
    },
    avatar_put(profile: number, image: Uint8Array): void {
      queries.put.run(profile, image, Date.now());
    },
    avatar_delete(profile: number): void {
      queries.delete.run(profile);
    },
    avatar_shuffle(profile: number): void {
      queries.shuffle.run(randomInt(1, 2 ** 31), profile);
    },
  };
}
