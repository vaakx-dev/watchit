import { randomBytes, randomInt, scryptSync, timingSafeEqual } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { PIN_LENGTH } from '../../src/profiles/types.ts';
import { validate_pin } from './validation.ts';

const KEY_LENGTH = 32;
const FREE_ATTEMPTS = 5;
const FIRST_LOCK_MS = 30_000;
const LONGEST_LOCK_MS = 15 * 60_000;

export type PinHash = { salt: Uint8Array; hash: Uint8Array };
type Attempts = { failures: number; locked_until: number };

export class PinError extends Error {
  constructor(readonly status: 403 | 429, message: string, readonly retry_after?: number) { super(message); }
}

export function hash_pin(pin: string): PinHash {
  validate_pin(pin);
  const salt = randomBytes(16);
  return { salt, hash: scryptSync(pin, salt, KEY_LENGTH) };
}

export function pin_matches(pin: string, { salt, hash }: PinHash): boolean {
  return timingSafeEqual(scryptSync(pin, salt, KEY_LENGTH), hash);
}

export function random_pin(): string {
  return String(randomInt(0, 10 ** PIN_LENGTH)).padStart(PIN_LENGTH, '0');
}

function lock_ms(failures: number): number {
  return Math.min(FIRST_LOCK_MS * 2 ** (failures - FREE_ATTEMPTS), LONGEST_LOCK_MS);
}

function locked(until: number, now: number): PinError {
  const seconds = Math.ceil((until - now) / 1000);
  return new PinError(429, `Too many wrong PINs. Try again in ${seconds} seconds.`, seconds);
}

export function create_pins(database: DatabaseSync) {
  const queries = {
    get: database.prepare('SELECT salt, hash FROM profile_pins WHERE profile_id = ?'),
    put: database.prepare(`INSERT INTO profile_pins (profile_id, salt, hash) VALUES (?, ?, ?)
      ON CONFLICT(profile_id) DO UPDATE SET salt = excluded.salt, hash = excluded.hash`),
    delete: database.prepare('DELETE FROM profile_pins WHERE profile_id = ?'),
    attempts: database.prepare('SELECT failures, locked_until FROM pin_attempts WHERE scope = ?'),
    fail: database.prepare(`INSERT INTO pin_attempts (scope, failures, locked_until) VALUES (?, 1, 0)
      ON CONFLICT(scope) DO UPDATE SET failures = failures + 1 RETURNING failures`),
    lock: database.prepare('UPDATE pin_attempts SET locked_until = ? WHERE scope = ?'),
    clear: database.prepare('DELETE FROM pin_attempts WHERE scope = ?'),
  };

  function scopes(profile: number, client: string): string[] {
    return [`profile:${profile}`, `client:${client}`];
  }

  function fail(scope: string, now: number): number {
    const { failures } = queries.fail.get(scope) as Pick<Attempts, 'failures'>;
    if (failures >= FREE_ATTEMPTS) queries.lock.run(now + lock_ms(failures), scope);
    return failures;
  }

  return {
    pin_check(profile: number, pin: string | undefined, client: string): void {
      const stored = queries.get.get(profile) as PinHash | undefined;
      if (!stored) return;
      if (pin === undefined) throw new PinError(403, 'This profile has a PIN. Enter it to continue.');
      const now = Date.now();
      const until = Math.max(...scopes(profile, client).map(scope => (queries.attempts.get(scope) as Attempts | undefined)?.locked_until ?? 0));
      if (until > now) throw locked(until, now);
      if (pin_matches(pin, stored)) {
        for (const scope of scopes(profile, client)) queries.clear.run(scope);
        return;
      }
      const failures = Math.max(...scopes(profile, client).map(scope => fail(scope, now)));
      if (failures >= FREE_ATTEMPTS) throw locked(now + lock_ms(failures), now);
      const left = FREE_ATTEMPTS - failures;
      throw new PinError(403, `Wrong PIN. ${left} ${left === 1 ? 'try' : 'tries'} left before a pause.`);
    },
    pin_set(profile: number, pin: string | null): void {
      if (pin === null) queries.delete.run(profile);
      else {
        const { salt, hash } = hash_pin(pin);
        queries.put.run(profile, salt, hash);
      }
      queries.clear.run(`profile:${profile}`);
    },
  };
}
