import { expect, it } from 'vitest';
import { DISCOVER_DEFAULTS } from './discover';
import { RANKINGS_DEFAULTS } from './rankings';
import { legacy_target, parse_route, search_route } from './route';

it('parses canonical title links and search terms', () => {
  expect(parse_route('')).toEqual({ view: 'tonight' });
  expect(parse_route('#/title/tt0133093')).toEqual({ view: 'title', id: 'tt0133093' });
  expect(parse_route('#/watch/tt0903747:1:2')).toEqual({ view: 'watch', id: 'tt0903747:1:2' });
  expect(parse_route(search_route('Dune & drama?'))).toEqual({ view: 'search', query: 'Dune & drama?' });
});

it('parses the main destinations and their filters', () => {
  expect(parse_route('#/discover')).toEqual({ view: 'discover', query: DISCOVER_DEFAULTS });
  expect(parse_route('#/discover?type=anime')).toEqual({ view: 'discover', query: { ...DISCOVER_DEFAULTS, kind: 'anime' } });
  expect(parse_route('#/discover?type=unknown')).toEqual({ view: 'discover', query: DISCOVER_DEFAULTS });
  expect(parse_route('#/mine')).toEqual({ view: 'mine', shelf: 'watching' });
  expect(parse_route('#/mine?status=paused')).toEqual({ view: 'mine', shelf: 'paused' });
  expect(parse_route('#/mine?status=favorite')).toEqual({ view: 'mine', shelf: 'favorite' });
  expect(parse_route('#/mine?view=recent')).toEqual({ view: 'mine', shelf: 'recent' });
  expect(parse_route('#/rankings')).toEqual({ view: 'rankings', query: RANKINGS_DEFAULTS });
  expect(parse_route('#/settings')).toEqual({ view: 'settings', section: null });
  expect(parse_route('#/profiles')).toEqual({ view: 'profiles' });
});

it('redirects the old catalog and personal pages', () => {
  expect(legacy_target('#/movies')).toBe('#/discover?type=movie');
  expect(legacy_target('#/series')).toBe('#/discover?type=series');
  expect(legacy_target('#/anime')).toBe('#/discover?type=anime');
  expect(legacy_target('#/saved')).toBe('#/mine?status=saved');
  expect(legacy_target('#/history')).toBe('#/mine?view=recent');
  expect(legacy_target('#/discover')).toBeUndefined();
  expect(parse_route('#/movies')).toEqual({ view: 'discover', query: { ...DISCOVER_DEFAULTS, kind: 'movie' } });
  expect(parse_route('#/history')).toEqual({ view: 'mine', shelf: 'recent' });
});

it('treats malformed and unknown paths as missing pages', () => {
  for (const hash of ['#/watch/', '#/title/../../x', '#http://[', '#/elsewhere', '#/watch/arrival-2016', '#/title/%741234567', '#/title/tt123', '#/watch/tt0903747:1', '#/title/tt0133093\n']) {
    expect(parse_route(hash)).toEqual({ view: 'missing' });
  }
});
