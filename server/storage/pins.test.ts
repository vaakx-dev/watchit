import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { create_store } from './index.ts';
import { hash_pin, PinError, pin_matches, random_pin } from './pins.ts';
import type { Store } from './types.ts';

let directory: string;
let store: Store;
let kid: number;

function attempt(profile: number, pin: string | undefined, client = 'phone'): PinError | null {
  try {
    store.pin_check(profile, pin, client);
    return null;
  } catch (error) {
    if (error instanceof PinError) return error;
    throw error;
  }
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  directory = mkdtempSync(join(tmpdir(), 'streamit-pins-'));
  store = create_store(directory);
  store.profile_create('dry');
  kid = store.profile_create('kid').id;
  store.pin_set(kid, '1234');
});
afterEach(() => {
  store.close();
  rmSync(directory, { recursive: true, force: true });
  vi.useRealTimers();
});

describe('PIN hashes', () => {
  it('salts every hash and matches only the same PIN', () => {
    const first = hash_pin('1234');
    const second = hash_pin('1234');
    expect(Buffer.from(first.salt).equals(Buffer.from(second.salt))).toBe(false);
    expect(Buffer.from(first.hash).equals(Buffer.from(second.hash))).toBe(false);
    expect(pin_matches('1234', first)).toBe(true);
    expect(pin_matches('1243', first)).toBe(false);
    for (const pin of ['123', '12345', '12a4', '١٢٣٤', '']) expect(() => hash_pin(pin)).toThrow('exactly 4 digits');
    expect(random_pin()).toMatch(/^\d{4}$/);
  });
});

describe('PIN checks', () => {
  it('passes profiles without a PIN and asks for it otherwise', () => {
    const dry = store.profile_list()[0]!.id;
    expect(attempt(dry, undefined)).toBeNull();
    expect(attempt(kid, undefined)).toMatchObject({ status: 403, message: expect.stringContaining('has a PIN') });
    expect(attempt(kid, '1234')).toBeNull();
    expect(store.profile_get(kid)).toEqual(expect.objectContaining({ has_pin: true }));
    expect(Object.keys(store.profile_get(kid)!)).toEqual(['id', 'name', 'created_at', 'is_admin', 'has_pin', 'avatar']);
  });

  it('locks after five wrong PINs, doubles the pause up to 15 minutes and keeps it across restarts', () => {
    for (const left of [4, 3, 2, 1]) expect(attempt(kid, '0000')).toMatchObject({ status: 403, message: expect.stringContaining(`${left} tr`) });
    expect(attempt(kid, '0000')).toMatchObject({ status: 429, retry_after: 30 });
    expect(attempt(kid, '1234')).toMatchObject({ status: 429, retry_after: 30 });
    store.close();
    store = create_store(directory);
    expect(attempt(kid, '1234', 'laptop')).toMatchObject({ status: 429 });
    for (const pause of [60, 120, 240, 480, 900, 900]) {
      vi.advanceTimersByTime(901_000);
      expect(attempt(kid, '0000', 'laptop')).toMatchObject({ status: 429, retry_after: pause });
    }
    vi.advanceTimersByTime(900_000);
    expect(attempt(kid, '1234')).toBeNull();
    expect(attempt(kid, '0000')).toMatchObject({ status: 403, message: expect.stringContaining('4 tries') });
  });

  it('limits one client across profiles without locking out other clients', () => {
    const teen = store.profile_create('teen').id;
    store.pin_set(teen, '5678');
    for (let index = 0; index < 3; index++) attempt(kid, '0000', 'phone');
    attempt(teen, '0000', 'phone');
    expect(attempt(teen, '0000', 'phone')).toMatchObject({ status: 429 });
    expect(attempt(teen, '5678', 'phone')).toMatchObject({ status: 429 });
    expect(attempt(teen, '5678', 'tv')).toBeNull();
    expect(attempt(kid, '1234', 'tv')).toBeNull();
  });

  it('clears a profile lock when its PIN is set again, and removes PINs', () => {
    for (let index = 0; index < 5; index++) attempt(kid, '0000', `client ${index}`);
    expect(attempt(kid, '1234', 'tv')).toMatchObject({ status: 429 });
    store.pin_set(kid, '4321');
    expect(attempt(kid, '1234', 'tv')).toMatchObject({ status: 403 });
    expect(attempt(kid, '4321', 'tv')).toBeNull();
    store.pin_set(kid, null);
    expect(store.profile_get(kid)?.has_pin).toBe(false);
    expect(attempt(kid, undefined)).toBeNull();
  });
});

describe('sessions', () => {
  it('stores only token hashes, revokes the other sessions of a profile and dies with the profile', () => {
    const first = store.session_create(kid);
    const second = store.session_create(kid);
    expect(first).toMatch(/^[\w-]{43}$/);
    expect(first).not.toBe(second);
    expect([store.session_profile(first), store.session_profile('forged')]).toEqual([kid, null]);
    store.sessions_revoke(kid, second);
    expect([store.session_profile(first), store.session_profile(second)]).toEqual([null, kid]);
    store.session_delete(second);
    expect(store.session_profile(second)).toBeNull();
    const third = store.session_create(kid);
    store.profile_delete(kid, 'kid');
    expect(store.session_profile(third)).toBeNull();
  });
});
