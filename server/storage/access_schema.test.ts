import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { create_store } from './index.ts';

let directory: string;
let pin_file: string;

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'streamit-access-migration-'));
  pin_file = join(directory, 'dev-pin.txt');
  vi.stubEnv('STREAMIT_DEV_PIN_FILE', pin_file);
  const database = new DatabaseSync(join(directory, 'streamit.sqlite'));
  database.exec(`CREATE TABLE profiles (id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE COLLATE NOCASE, created_at TEXT NOT NULL);
    INSERT INTO profiles (name, created_at) VALUES ('dry', 'then'), ('dev', 'then'), ('kid', 'then');`);
  database.close();
});
afterEach(() => {
  vi.unstubAllEnvs();
  rmSync(directory, { recursive: true, force: true });
});

describe('admin and PIN migration', () => {
  it('makes dry and dev admins and gives dev a random PIN written to the PIN file', () => {
    const store = create_store(directory);
    expect(store.profile_list().map(({ name, is_admin, has_pin }) => ({ name, is_admin, has_pin }))).toEqual([
      { name: 'dry', is_admin: true, has_pin: false },
      { name: 'dev', is_admin: true, has_pin: true },
      { name: 'kid', is_admin: false, has_pin: false },
    ]);
    const pin = readFileSync(pin_file, 'utf8').trim();
    expect(pin).toMatch(/^\d{4}$/);
    const dev = store.profile_list()[1]!.id;
    expect(() => store.pin_check(dev, pin, 'test')).not.toThrow();
    expect(() => store.pin_check(dev, pin === '0000' ? '0001' : '0000', 'test')).toThrow('Wrong PIN');
    store.close();
  });

  it('runs once', () => {
    create_store(directory).close();
    rmSync(pin_file);
    const store = create_store(directory);
    expect(existsSync(pin_file)).toBe(false);
    expect(store.profile_list().map(profile => profile.has_pin)).toEqual([false, true, false]);
    store.close();
  });
});
