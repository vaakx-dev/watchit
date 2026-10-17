import type { Title } from '../../src/catalog/types.ts';
import { genre_id } from '../../src/catalog/identity.ts';
import type { ImportedTitle } from './types.ts';

export function title(id: string, patch: Partial<Title> = {}): Title {
  return {
    id, title: id, year: 2024, artwork: '', genres: [], kind: 'movie', anime: false, backdrop: '', minutes: null, synopsis: '',
    director: '', cast: '', imdb_id: null, tmdb_id: null, season: null, episode: null, series: null, related: [], images: [],
    source_url: '', ...patch,
  };
}

export function episode(series_id: string, season: number, number: number): Title {
  return title(`${series_id}:${season}:${number}`, { kind: 'episode', title: `S${season}E${number}`, season, episode: number,
    series: { id: series_id, title: series_id, imdb_id: null, tmdb_id: null } });
}

export function imported(item: Title): ImportedTitle {
  return { title: item, genres: item.genres.map(label => ({ id: genre_id(label), label })) };
}
