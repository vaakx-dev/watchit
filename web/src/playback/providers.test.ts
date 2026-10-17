import { describe, expect, it } from 'vitest';
import { PROVIDERS, pick_provider } from './providers';

const movie = { kind: 'movie', imdb_id: 'tt27681354', tmdb_id: 1122573, season: null, episode: null, series: null } as const;
const series = { ...movie, kind: 'series', imdb_id: 'tt0944947', tmdb_id: 1399 } as const;
const episode = {
  ...movie,
  kind: 'episode',
  imdb_id: null,
  tmdb_id: null,
  season: 1,
  episode: 2,
  series: { id: 'tt0944947', title: 'Example series', imdb_id: 'tt0944947', tmdb_id: 1399 },
} as const;

describe('provider routing', () => {
  it.each([
    ['smashy', 'https://embed.smashystream.com/playere.php?imdb=tt27681354'],
    ['2embed', 'https://www.2embed.cc/embed/tt27681354'],
    ['vidsrc', 'https://vidsrc.me/embed/tt27681354/'],
    ['vidplus', 'https://player.vidplus.to/embed/movie/1122573'],
  ])('builds the observed %s movie endpoint', (id, url) => {
    expect(PROVIDERS.find(provider => provider.id === id)?.url(movie)).toBe(url);
  });

  it('uses documented series and episode URL patterns', () => {
    const embed = PROVIDERS.find(provider => provider.id === '2embed')!;
    const vidsrc = PROVIDERS.find(provider => provider.id === 'vidsrc')!;
    expect(embed.url(series)).toBe('https://www.2embed.cc/embedtvfull/tt0944947');
    expect(embed.url(episode)).toBe('https://www.2embed.cc/embedtv/tt0944947&s=1&e=2');
    expect(vidsrc.url(episode)).toBe('https://vidsrc.me/embed/tv/tt0944947/1/2');
    expect(PROVIDERS.find(provider => provider.id === 'smashy')?.url(episode)).toBeNull();
  });

  it('does not guess missing identifiers or episode numbers', () => {
    expect(PROVIDERS[0].url({ ...movie, imdb_id: null, tmdb_id: null })).toBeNull();
    expect(PROVIDERS[0].url({ ...episode, season: null })).toBeNull();
    expect(PROVIDERS[0].url({ ...episode, series: null })).toBeNull();
  });

  it('only builds a 1Anime link from an explicit provider mapping', () => {
    const provider = PROVIDERS.find(item => item.id === 'one-anime')!;
    expect(provider.url(episode)).toBeNull();
    expect(provider.url({ ...episode, provider_ids: { one_anime: 'a'.repeat(32) } })).toBe(`https://my.1anime.site/play/${'a'.repeat(32)}`);
  });
});

describe('source choice', () => {
  const sources = PROVIDERS.filter(provider => provider.id !== 'smashy');

  it('plays the remembered source when this title offers it', () => {
    expect(pick_provider(sources, 'vidsrc')?.id).toBe('vidsrc');
  });

  it('falls back to 1Anime, then the first source', () => {
    expect(pick_provider(sources, 'smashy')?.id).toBe('one-anime');
    expect(pick_provider(PROVIDERS.filter(provider => provider.id !== 'one-anime'), null)?.id).toBe('2embed');
    expect(pick_provider([], 'vidsrc')).toBeUndefined();
  });
});
