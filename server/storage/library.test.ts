import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Title } from '../../src/catalog/types.ts';
import type { LibraryQuery } from '../../src/library/types.ts';
import { episode, imported, title } from './fixtures.ts';
import { create_store } from './index.ts';
import type { Store } from './types.ts';

const query: LibraryQuery = { shelf: 'watching', kind: 'all', sort: 'recent', page: 1 };
let directory: string;
let store: Store;
let profile: number;

function put(...titles: Title[]) {
  store.title_put(titles.map(imported));
}
function open(id: string, time: number) {
  vi.setSystemTime(time);
  store.personal_update(profile, id, { opened: true });
}

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'streamit-library-'));
  store = create_store(directory);
  profile = store.profile_create('test').id;
  vi.useFakeTimers({ toFake: ['Date'] });
  put(title('tt0000001', { title: 'Movie' }), title('tt0000002', { title: 'Series', kind: 'series' }),
    title('tt0000003', { title: 'Anime', kind: 'series', anime: true }),
    episode('tt0000002', 0, 1), episode('tt0000002', 1, 1), episode('tt0000002', 1, 2), episode('tt0000002', 2, 1));
});
afterEach(() => {
  vi.useRealTimers();
  store.close();
  rmSync(directory, { recursive: true, force: true });
});

describe('my shows', () => {
  it('counts every shelf per kind and folds episode history into its series', () => {
    store.personal_update(profile, 'tt0000001', { status: 'watched', favorite: true });
    store.personal_update(profile, 'tt0000003', { status: 'watching', saved: true });
    open('tt0000001', Date.UTC(2026, 0, 1));
    open('tt0000002:1:2', Date.UTC(2026, 0, 3));
    const recent = store.library_query(profile, { ...query, shelf: 'recent' });
    expect(recent.items.map(item => [item.title.id, item.opened_at])).toEqual([
      ['tt0000002', '2026-01-03T00:00:00.000Z'], ['tt0000001', '2026-01-01T00:00:00.000Z'],
    ]);
    expect(recent.items[0]?.entry).toEqual({ id: 'tt0000002', rating: null, status: null, favorite: false, recommended: false, saved: false, last_opened_at: null });
    expect(recent.counts).toEqual({ want: 0, watching: 1, paused: 0, watched: 1, dropped: 0, favorite: 1, recommended: 0, saved: 1, recent: 2 });
    expect(store.library_query(profile, { ...query, kind: 'series' }).counts).toMatchObject({ watching: 1, watched: 0, recent: 1 });
    expect(store.library_query(profile, { ...query, shelf: 'favorite' })).toMatchObject({ total: 1, has_next: false, items: [{ title: { id: 'tt0000001' }, progress: null }] });
    expect(store.library_query(profile, { ...query, kind: 'anime' }).items.map(item => item.title.id)).toEqual(['tt0000003']);
  });

  it('sorts shelves by title, year and your rating', () => {
    put(title('tt0000004', { title: 'B', year: 2001 }), title('tt0000005', { title: 'a', year: 2003 }), title('tt0000006', { title: 'C', year: 2002 }));
    for (const [id, rating] of [['tt0000004', 3], ['tt0000005', 1], ['tt0000006', 4.5]] as const) store.personal_update(profile, id, { status: 'want', rating });
    const order = (sort: LibraryQuery['sort']) => store.library_query(profile, { ...query, shelf: 'want', sort }).items.map(item => item.title.id);
    expect(order('title')).toEqual(['tt0000005', 'tt0000004', 'tt0000006']);
    expect(order('newest')).toEqual(['tt0000005', 'tt0000006', 'tt0000004']);
    expect(order('rating')).toEqual(['tt0000006', 'tt0000004', 'tt0000005']);
  });
});

describe('continue watching', () => {
  it('offers the first non-special episode, then the one after the last opened, and nothing once caught up', () => {
    expect(store.series_progress(profile, 'tt0000002')).toMatchObject({ last: null, next: { id: 'tt0000002:1:1' }, opened_at: null });
    open('tt0000002:1:2', Date.UTC(2026, 0, 2));
    open('tt0000002:1:1', Date.UTC(2026, 0, 1));
    expect(store.series_progress(profile, 'tt0000002')).toMatchObject({ last: { id: 'tt0000002:1:2' }, next: { id: 'tt0000002:2:1', season: 2, episode: 1 },
      opened_at: '2026-01-02T00:00:00.000Z' });
    open('tt0000002:2:1', Date.UTC(2026, 0, 4));
    expect(store.series_progress(profile, 'tt0000002')).toMatchObject({ last: { id: 'tt0000002:2:1' }, next: null });
    expect(store.series_progress(profile, 'tt0000003')).toEqual({ last: null, next: null, opened_at: null });
  });

  it('offers the episode after the furthest of the last opened and those marked watched', () => {
    store.personal_update(profile, 'tt0000002:0:1', { status: 'watched' });
    expect(store.series_progress(profile, 'tt0000002')).toMatchObject({ last: null, next: { id: 'tt0000002:1:1' } });
    store.personal_update(profile, 'tt0000002:1:1', { status: 'watched' });
    expect(store.series_progress(profile, 'tt0000002')).toMatchObject({ last: null, next: { id: 'tt0000002:1:2' } });
    open('tt0000002:1:2', Date.UTC(2026, 0, 1));
    expect(store.series_progress(profile, 'tt0000002')).toMatchObject({ last: { id: 'tt0000002:1:2' }, next: { id: 'tt0000002:2:1' } });
    open('tt0000002:1:1', Date.UTC(2026, 0, 2));
    expect(store.series_progress(profile, 'tt0000002')).toMatchObject({ last: { id: 'tt0000002:1:1' }, next: { id: 'tt0000002:1:2' } });
    store.personal_update(profile, 'tt0000002:2:1', { status: 'watched' });
    expect(store.series_progress(profile, 'tt0000002').next).toBeNull();
  });

  it('marks every episode of one season watched and unwatches them again', () => {
    const statuses = (entries: Record<string, { status: string | null }>) =>
      ['tt0000002:0:1', 'tt0000002:1:1', 'tt0000002:1:2', 'tt0000002:2:1'].map(id => entries[id]?.status ?? null);
    const marked = store.season_watched(profile, 'tt0000002', 1, true);
    expect(statuses(marked.entries)).toEqual([null, 'watched', 'watched', null]);
    expect(marked.progress.next).toMatchObject({ id: 'tt0000002:2:1' });
    const cleared = store.season_watched(profile, 'tt0000002', 1, false);
    expect(statuses(cleared.entries)).toEqual([null, null, null, null]);
    expect(cleared.progress.next).toMatchObject({ id: 'tt0000002:1:1' });
  });

  it('lists watching and paused titles, most recently opened first', () => {
    store.personal_update(profile, 'tt0000001', { status: 'paused' });
    store.personal_update(profile, 'tt0000002', { status: 'watching' });
    store.personal_update(profile, 'tt0000003', { status: 'watching' });
    put(title('tt0000004'));
    store.personal_update(profile, 'tt0000004', { status: 'want' });
    open('tt0000001', Date.UTC(2026, 0, 1));
    open('tt0000002:1:1', Date.UTC(2026, 0, 2));
    const page = store.continue_query(profile, 'all', 1);
    expect(page.items.map(item => [item.title.id, item.entry.status, item.progress?.next?.id ?? null])).toEqual([
      ['tt0000002', 'watching', 'tt0000002:1:2'], ['tt0000001', 'paused', null], ['tt0000003', 'watching', null],
    ]);
    expect(store.continue_query(profile, 'movie', 1).items.map(item => item.title.id)).toEqual(['tt0000001']);
  });
});

describe('playback source', () => {
  it('remembers the chosen source per title and stores episode choices on the series', () => {
    expect(store.playback_update(profile, 'tt0000002:1:1', 'vidsrc')).toEqual({ id: 'tt0000002', source: 'vidsrc' });
    expect(store.playback_source(profile, 'tt0000002')).toBe('vidsrc');
    expect(store.playback_source(profile, 'tt0000002:2:1')).toBe('vidsrc');
    store.playback_update(profile, 'tt0000001', '2embed');
    expect(store.playback_update(profile, 'tt0000002', null)).toEqual({ id: 'tt0000002', source: null });
    expect([store.playback_source(profile, 'tt0000002'), store.playback_source(profile, 'tt0000001')]).toEqual([null, '2embed']);
    expect(() => store.playback_update(profile, 'tt0000001', 'Bad Source')).toThrow(RangeError);
  });
});
