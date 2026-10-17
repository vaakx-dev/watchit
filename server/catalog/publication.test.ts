import { describe, expect, it } from 'vitest';
import { Mapping } from './mapping.ts';
import { merge_catalog } from './publication.ts';
import type { Meta } from './schema.ts';

const mapping = new Mapping({ register: url => `/media/${encodeURIComponent(url)}`, get: async () => { throw new Error('No downloads'); } });
const meta: Meta = { id: 'tt0133093', type: 'movie', name: 'The Matrix', description: 'Full description',
  runtime: '136 min', genres: ['Action', 'Sci-Fi'], director: ['A director'], cast: ['An actor'], moviedb_id: 603,
  poster: 'https://images.metahub.space/poster/small/tt0133093/img', background: 'https://images.metahub.space/background/medium/tt0133093/img' };

describe('catalog publication', () => {
  it('updates supplied fields without erasing Cinemeta detail absent from a partial search', () => {
    const previous = mapping.imported(meta)!.title;
    const incoming = mapping.imported({ id: meta.id, type: 'movie', name: 'Updated name', poster: 'https://m.media-amazon.com/images/new.jpg' })!;
    const result = merge_catalog(incoming, previous);
    expect(result.title).toMatchObject({ title: 'Updated name', synopsis: 'Full description', director: 'A director',
      cast: 'An actor', minutes: 136, tmdb_id: 603, genres: ['Action', 'Sci-Fi'], backdrop: previous.backdrop });
    expect(result.title.images.map(image => image.source_url)).toEqual([meta.background, 'https://m.media-amazon.com/images/new.jpg']);
    expect(result.genres.map(genre => genre.id)).toEqual(['action', 'sci-fi']);
  });

  it('refreshes supplied catalog metadata, including explicit removal and classification changes', () => {
    const previous = mapping.imported({ ...meta, genres: ['Animation'], country: 'Japan' })!.title;
    const incoming = mapping.imported({ ...meta, description: 'Changed description', genres: ['Animation'], country: 'United States', director: null, poster: '' })!;
    const result = merge_catalog(incoming, previous);
    expect(result.title).toMatchObject({ synopsis: 'Changed description', anime: false, director: '', artwork: '' });
    expect(result.title.images.some(image => image.role === 'poster')).toBe(false);
  });

});
