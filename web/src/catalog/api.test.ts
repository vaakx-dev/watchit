import { describe, expect, it } from 'vitest';
import { awaiting_items, awaiting_refresh, awaiting_update, poll_delay } from './api';
import type { CatalogEntry, ImportStatus } from './types';

const imports: ImportStatus = { enabled: true, pending: true, running: true, imported: 0, error: null, next_retry_at: null };
const entry: CatalogEntry = { id: 'tt0133093', title: 'The Matrix', year: 1999, artwork: '', genres: ['Sci-fi'], kind: 'movie', anime: false, imdb_rating: null };

describe('catalog loading state', () => {
  it('backs off polling geometrically up to a cap', () => {
    expect(poll_delay(0)).toBe(1500);
    expect(poll_delay(1)).toBe(3000);
    expect(poll_delay(2)).toBe(6000);
    expect(poll_delay(10)).toBe(30000);
  });

  it('keeps polling quickly while a page has nothing to show', () => {
    expect(poll_delay(0, true)).toBe(2500);
    expect(poll_delay(10, true)).toBe(2500);
  });

  it('polls only while the page waits for items or missing artwork', () => {
    const artwork_status = { pending: true, running: true, error: null };
    expect(awaiting_update({ imports }, [])).toBe(true);
    expect(awaiting_update({ imports }, [entry])).toBe(false);
    expect(awaiting_update({ imports: { ...imports, pending: false } }, [])).toBe(false);
    expect(awaiting_update({ artwork_status }, [entry])).toBe(true);
    expect(awaiting_update({ artwork_status }, [{ ...entry, artwork: '/art.jpg' }])).toBe(false);
    expect(awaiting_update({ artwork_status: { ...artwork_status, pending: false } }, [entry])).toBe(false);
  });

  it('polls a title only while its stale detail is being refreshed', () => {
    const result = { freshness: { updated_at: '', stale: true }, imports };
    expect(awaiting_refresh(result)).toBe(true);
    expect(awaiting_refresh({ ...result, freshness: { updated_at: '', stale: false } })).toBe(false);
    expect(awaiting_refresh({ ...result, imports: { ...imports, pending: false } })).toBe(false);
    expect(awaiting_refresh({ ...result, imports: { ...imports, error: 'Source unavailable' } })).toBe(false);
  });

  it('distinguishes a pending request from an unused resource', () => {
    expect(awaiting_items({ status: 'loading' })).toBe(true);
    expect(awaiting_items({ status: 'idle' })).toBe(false);
  });

  it('waits for an initial import without hiding imported titles during refresh', () => {
    expect(awaiting_items({ status: 'ready', data: { items: [], imports } })).toBe(true);
    expect(awaiting_items({ status: 'ready', data: { items: [entry], imports } })).toBe(false);
  });

  it('does not treat errors or completed empty results as loading', () => {
    expect(awaiting_items({ status: 'error', error: 'Offline' })).toBe(false);
    expect(awaiting_items({ status: 'ready', data: { items: [] } })).toBe(false);
    expect(awaiting_items({ status: 'ready', data: { items: [], imports: { ...imports, pending: false } } })).toBe(false);
    expect(awaiting_items({ status: 'ready', data: { items: [], imports: { ...imports, error: 'Source unavailable' } } })).toBe(false);
  });
});
