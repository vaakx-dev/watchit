import { expect, it } from 'vitest';
import { DISCOVER_DEFAULTS, discover_href, parse_discover } from './discover';

function parse(href: string) {
  return parse_discover(new URLSearchParams(href.split('?')[1]));
}

it('leaves defaults out of the link', () => {
  expect(discover_href({})).toBe('#/discover');
  expect(discover_href(DISCOVER_DEFAULTS)).toBe('#/discover');
  expect(discover_href({ kind: 'movie' })).toBe('#/discover?type=movie');
});

it('round-trips every filter through the link', () => {
  const query = { kind: 'series', sort: 'top_rated', genre: 'science-fiction', hide_watched: false } as const;
  const href = discover_href(query);
  expect(href).toBe('#/discover?type=series&sort=top_rated&genre=science-fiction&watched=show');
  expect(parse(href)).toEqual(query);
});

it('ignores unknown values', () => {
  expect(parse('#/discover?type=books&sort=random&watched=maybe')).toEqual(DISCOVER_DEFAULTS);
});
