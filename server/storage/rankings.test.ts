import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CatalogKind } from '../../src/catalog/types.ts';
import { episode, imported, title } from './fixtures.ts';
import { create_store } from './index.ts';
import type { Store } from './types.ts';

let directory: string;
let store: Store;
let profile: number;

function tiers(kind: CatalogKind = 'all') {
  return store.rankings_get(profile, kind).tiers.map(tier => [tier.rating, tier.items.map(item => item.title.id)]);
}

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'streamit-rankings-'));
  store = create_store(directory);
  profile = store.profile_create('test').id;
  store.title_put([title('tt0000001'), title('tt0000002'), title('tt0000003', { kind: 'series' }), title('tt0000004'),
    title('tt0000005', { kind: 'series' }), episode('tt0000003', 1, 1)].map(imported));
});
afterEach(() => {
  vi.restoreAllMocks();
  store.close();
  rmSync(directory, { recursive: true, force: true });
});

describe('rankings', () => {
  it('groups rated movies and series into tiers with overall ranks and positions per kind', () => {
    store.personal_update(profile, 'tt0000001', { rating: 4 });
    store.personal_update(profile, 'tt0000002', { rating: 5 });
    store.personal_update(profile, 'tt0000003', { rating: 4 });
    store.personal_update(profile, 'tt0000003:1:1', { rating: 5 });
    expect(tiers()).toEqual([[5, ['tt0000002']], [4, ['tt0000001', 'tt0000003']]]);
    expect(store.rankings_get(profile, 'series').tiers).toMatchObject([{ rating: 4, items: [{ title: { id: 'tt0000003' }, rank: 1, position: 1, progress: { next: { id: 'tt0000003:1:1' } } }] }]);
    expect(store.rankings_get(profile, 'all').tiers[1]?.items.map(item => [item.rank, item.position])).toEqual([[2, 1], [3, 2]]);
  });

  it('puts raised and new ratings at the bottom of their tier, lowered ones at the top, and drops cleared ones', () => {
    for (const id of ['tt0000001', 'tt0000002', 'tt0000003']) store.personal_update(profile, id, { rating: 4 });
    store.personal_update(profile, 'tt0000004', { rating: 3 });
    store.personal_update(profile, 'tt0000005', { rating: 5 });
    store.personal_update(profile, 'tt0000004', { rating: 4 });
    expect(tiers()).toEqual([[5, ['tt0000005']], [4, ['tt0000001', 'tt0000002', 'tt0000003', 'tt0000004']]]);
    store.personal_update(profile, 'tt0000005', { rating: 4 });
    expect(tiers()[0]).toEqual([4, ['tt0000005', 'tt0000001', 'tt0000002', 'tt0000003', 'tt0000004']]);
    store.personal_update(profile, 'tt0000001', { rating: null });
    store.personal_update(profile, 'tt0000002', { status: 'watched' });
    expect(tiers()).toEqual([[4, ['tt0000005', 'tt0000002', 'tt0000003', 'tt0000004']]]);
  });

  it('moves a title within its tier and rejects moves into another tier or of unrated titles', () => {
    for (const id of ['tt0000001', 'tt0000002', 'tt0000003', 'tt0000004']) store.personal_update(profile, id, { rating: 4.5 });
    store.personal_update(profile, 'tt0000005', { rating: 2 });
    expect(store.ranking_move(profile, 'tt0000004', 'tt0000001', 'all').tiers[0]?.items.map(item => item.title.id))
      .toEqual(['tt0000004', 'tt0000001', 'tt0000002', 'tt0000003']);
    store.ranking_move(profile, 'tt0000004', null, 'all');
    expect(tiers()[0]).toEqual([4.5, ['tt0000001', 'tt0000002', 'tt0000003', 'tt0000004']]);
    expect(store.ranking_move(profile, 'tt0000001', 'tt0000003', 'movie').tiers[0]?.items.map(item => [item.title.id, item.position]))
      .toEqual([['tt0000002', 1], ['tt0000001', 2], ['tt0000004', 3]]);
    expect(() => store.ranking_move(profile, 'tt0000001', 'tt0000005', 'all')).toThrow(RangeError);
    expect(() => store.ranking_move(profile, 'tt0000003:1:1', null, 'all')).toThrow(RangeError);
    expect(tiers()[0]).toEqual([4.5, ['tt0000002', 'tt0000001', 'tt0000003', 'tt0000004']]);
  });
});
