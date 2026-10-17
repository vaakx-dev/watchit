import { createHash, randomBytes } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';

const TOUCH_INTERVAL_MS = 60_000;

function token_hash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function create_sessions(database: DatabaseSync) {
  const queries = {
    insert: database.prepare('INSERT INTO sessions (token_hash, profile_id, created_at, last_used_at) VALUES (?, ?, ?, ?)'),
    get: database.prepare('SELECT profile_id, last_used_at FROM sessions WHERE token_hash = ?'),
    touch: database.prepare('UPDATE sessions SET last_used_at = ? WHERE token_hash = ?'),
    delete: database.prepare('DELETE FROM sessions WHERE token_hash = ?'),
    revoke: database.prepare('DELETE FROM sessions WHERE profile_id = ? AND token_hash IS NOT ?'),
  };

  return {
    session_create(profile: number): string {
      const token = randomBytes(32).toString('base64url');
      const now = new Date().toISOString();
      queries.insert.run(token_hash(token), profile, now, now);
      return token;
    },
    session_profile(token: string): number | null {
      const hash = token_hash(token);
      const session = queries.get.get(hash) as { profile_id: number; last_used_at: string } | undefined;
      if (!session) return null;
      if (Date.now() - Date.parse(session.last_used_at) > TOUCH_INTERVAL_MS) queries.touch.run(new Date().toISOString(), hash);
      return session.profile_id;
    },
    session_delete(token: string): void {
      queries.delete.run(token_hash(token));
    },
    sessions_revoke(profile: number, keep: string | null): void {
      queries.revoke.run(profile, keep === null ? null : token_hash(keep));
    },
  };
}
