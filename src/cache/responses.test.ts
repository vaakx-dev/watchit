import { describe, expect, it } from 'vitest';
import { create_responses } from './responses';

describe('browser response cache', () => {
  it('restores a confirmed page synchronously after reload', () => {
    const values = new Map<string, string>();
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
    const first = create_responses(storage);
    const page = { items: [{ id: 'tt0133093', title: 'The Matrix' }] };
    first.set('/api/catalog?page=1', page);
    first.flush();

    const reloaded = create_responses(storage);
    expect(reloaded.get('/api/catalog?page=1')).toEqual(page);
  });

  it('keeps each profile’s cached responses apart', () => {
    const values = new Map<string, string>();
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
    const dry = create_responses(storage, 1);
    dry.set('/api/library', { entries: { tt0133093: {} } });
    dry.flush();

    expect(create_responses(storage, 2).get('/api/library')).toBeUndefined();
    expect(create_responses(storage, 1).get('/api/library')).toEqual({ entries: { tt0133093: {} } });
  });

  it('keeps recently used views instead of growing without a bound', () => {
    const cache = create_responses();
    for (let page = 1; page <= 32; page++) cache.set(String(page), { page });
    cache.get('1');
    cache.set('33', { page: 33 });
    expect(cache.get('1')).toEqual({ page: 1 });
    expect(cache.get('2')).toBeUndefined();
    expect(cache.get('33')).toEqual({ page: 33 });
  });
});
