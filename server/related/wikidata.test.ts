import { describe, expect, it } from 'vitest';
import { franchise_order } from './wikidata.ts';

describe('franchise_order', () => {
  it('picks the smallest series holding the title and orders it by ordinal, then date', () => {
    const rows = [
      { series: 'Q-saga', name: 'Saga', imdb: 'tt0000004', ordinal: '4', date: '2012' },
      { series: 'Q-saga', name: 'Saga', imdb: 'tt0000001', ordinal: '1', date: '2001' },
      { series: 'Q-trilogy', name: 'Trilogy', imdb: 'tt0000009', date: '2024' },
      { series: 'Q-trilogy', name: 'Trilogy', imdb: 'tt0000002', ordinal: '2', date: '2002' },
      { series: 'Q-trilogy', name: 'Trilogy', imdb: 'tt0000001', ordinal: '1', date: '2001' },
      { series: 'Q-saga', name: 'Saga', imdb: 'tt0000002', ordinal: '2', date: '2002' },
      { series: 'Q-saga', name: 'Saga', imdb: 'tt0000009', ordinal: '9', date: '2024' },
    ];
    expect(franchise_order('tt0000001', rows)).toEqual({ name: 'Trilogy', ids: ['tt0000001', 'tt0000002', 'tt0000009'] });
  });

  it('falls back to the follows chain ordered by date', () => {
    const rows = [{ imdb: 'tt0000003', date: '2010' }, { imdb: 'tt0000002', date: '2000' }, { imdb: 'tt0000001', date: '1990' }];
    expect(franchise_order('tt0000002', rows)).toEqual({ name: null, ids: ['tt0000001', 'tt0000002', 'tt0000003'] });
  });
});
