import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { episode, imported, title } from './fixtures.ts';
import { create_store } from './index.ts';
import type { Store } from './types.ts';

const query = { shelf: 'watching', kind: 'all', sort: 'recent', page: 1 } as const;
let directory: string;
let store: Store;

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'streamit-profiles-'));
  store = create_store(directory);
  store.title_put([title('tt0000001'), title('tt0000002', { kind: 'series' }), episode('tt0000002', 1, 1), episode('tt0000002', 1, 2)]
    .map(imported));
});
afterEach(() => {
  store.close();
  rmSync(directory, { recursive: true, force: true });
});

describe('profiles', () => {
  it('creates, renames and validates names case-insensitively', () => {
    const dry = store.profile_create('  dry ');
    expect(dry).toMatchObject({ name: 'dry' });
    expect(() => store.profile_create('DRY')).toThrow('already exists');
    expect(() => store.profile_create(' ')).toThrow('1 to 24 characters');
    expect(() => store.profile_create('x'.repeat(25))).toThrow('1 to 24 characters');
    expect(() => store.profile_create('a\nb')).toThrow('1 to 24 characters');
    expect(store.profile_create('😀'.repeat(24)).name).toHaveLength(48);
    const dev = store.profile_create('dev');
    expect(() => store.profile_update(dev.id, { name: 'Dry' })).toThrow('already exists');
    expect(store.profile_update(dry.id, { name: 'Dry' })).toMatchObject({ id: dry.id, name: 'Dry' });
    expect(() => store.profile_update(999, { name: 'other' })).toThrow('Profile not found');
  });

  it('deletes a profile and its personal rows only with the name as confirmation, keeping the last one', () => {
    const dry = store.profile_create('dry');
    const dev = store.profile_create('dev');
    store.personal_update(dev.id, 'tt0000002', { rating: 4, status: 'watching', favorite: true });
    store.season_update(dev.id, 'tt0000002', 1, 3);
    store.playback_update(dev.id, 'tt0000002', 'vidsrc');
    expect(() => store.profile_delete(dev.id, 'Dev')).toThrow('Confirm');
    expect(store.profile_delete(dev.id, 'dev')).toEqual([dry]);
    expect(() => store.profile_delete(dry.id, 'dry')).toThrow('last profile');
    const again = store.profile_create('dev');
    expect(store.library_get(again.id)).toEqual({ entries: {}, seasons: {}, saved: [], recent: [] });
    expect(store.playback_source(again.id, 'tt0000002')).toBeNull();
  });

  it('makes the first profile an admin and always keeps one admin', () => {
    const dry = store.profile_create('dry');
    const kid = store.profile_create('kid');
    expect([dry.is_admin, kid.is_admin, kid.has_pin]).toEqual([true, false, false]);
    expect(() => store.profile_update(dry.id, { name: 'Boss', is_admin: false })).toThrow('another profile an admin');
    expect(store.profile_get(dry.id)).toEqual(dry);
    expect(() => store.profile_delete(dry.id, 'dry')).toThrow('only admin');
    expect(store.profile_update(kid.id, { is_admin: true })).toMatchObject({ is_admin: true });
    expect(store.profile_update(dry.id, { name: 'Boss', is_admin: false })).toMatchObject({ name: 'Boss', is_admin: false });
    expect(store.profile_delete(dry.id, 'Boss')).toEqual([{ ...kid, is_admin: true }]);
  });

  it('keeps every kind of personal data separate between profiles', () => {
    const dry = store.profile_create('dry').id;
    const dev = store.profile_create('dev').id;
    store.personal_update(dry, 'tt0000001', { rating: 5, status: 'watched', saved: true, favorite: true, opened: true });
    store.personal_update(dry, 'tt0000002', { rating: 5, status: 'watching' });
    store.personal_update(dry, 'tt0000002:1:1', { opened: true, status: 'watched' });
    store.season_update(dry, 'tt0000002', 1, 4.5);
    store.ranking_move(dry, 'tt0000001', 'tt0000002', 'all');
    store.playback_update(dry, 'tt0000002', 'vidsrc');
    store.personal_update(dev, 'tt0000001', { status: 'dropped' });
    store.trending_put('movie', ['tt0000001']);
    const catalog = { kind: 'all', page: 1, query: '', genre: '', sort: 'title' } as const;

    expect(store.library_get(dev).entries).toEqual({
      tt0000001: { id: 'tt0000001', rating: null, status: 'dropped', favorite: false, recommended: false, saved: false, last_opened_at: null },
    });
    expect(store.library_get(dev)).toMatchObject({ seasons: {}, saved: [], recent: [] });
    expect(store.library_query(dev, { ...query, shelf: 'recent' }).counts).toMatchObject({ watched: 0, watching: 0, dropped: 1, recent: 0 });
    expect(store.continue_query(dev, 'all', 1).items).toEqual([]);
    expect(store.rankings_get(dev, 'all').tiers).toEqual([]);
    expect(store.series_progress(dev, 'tt0000002')).toMatchObject({ last: null, next: { id: 'tt0000002:1:1' } });
    expect(store.playback_source(dev, 'tt0000002:1:2')).toBeNull();
    expect(store.trending_query({ kind: 'movie', page: 1 }, { profile: dev, statuses: ['watched'] }).items).toMatchObject([{ id: 'tt0000001' }]);
    expect(store.catalog_query(catalog, { profile: dev, statuses: ['watched'] }).items.map(item => item.id)).toEqual(['tt0000001', 'tt0000002']);

    expect(store.library_query(dry, query).counts).toMatchObject({ watched: 1, watching: 1, dropped: 0, favorite: 1, saved: 1, recent: 2 });
    expect(store.continue_query(dry, 'all', 1).items.map(item => item.title.id)).toEqual(['tt0000002']);
    expect(store.rankings_get(dry, 'all').tiers[0]?.items.map(item => item.title.id)).toEqual(['tt0000001', 'tt0000002']);
    expect(store.series_progress(dry, 'tt0000002')).toMatchObject({ last: { id: 'tt0000002:1:1' }, next: { id: 'tt0000002:1:2' } });
    expect(store.playback_source(dry, 'tt0000002:1:2')).toBe('vidsrc');
    expect(store.library_get(dry).seasons).toEqual({ tt0000002: { 1: 4.5 } });
    expect(store.trending_query({ kind: 'movie', page: 1 }, { profile: dry, statuses: ['watched'] }).items).toEqual([]);
    expect(store.catalog_query(catalog, { profile: dry, statuses: ['watched'] }).items.map(item => item.id)).toEqual(['tt0000002']);
  });
});
