import { describe, expect, it } from 'vitest';
import { genre_labels, genre_options, genre_sources } from './genres.ts';

describe('genre normalisation', () => {
  it('merges duplicate labels, splits combined ones and drops hidden genres', () => {
    expect(genre_labels(['Sci-Fi', 'Science Fiction', 'Drama'])).toEqual(['Science Fiction', 'Drama']);
    expect(genre_labels(['Action & Adventure', 'Adventure', 'Sci-Fi & Fantasy'])).toEqual(['Action', 'Adventure', 'Science Fiction', 'Fantasy']);
    expect(genre_labels(['Adult', 'Kids', 'Reality'])).toEqual(['Family', 'Reality-TV']);
  });

  it('builds facet options with canonical labels and marks minor genres', () => {
    expect(genre_options([{ id: 'sci-fi', label: 'Sci-Fi' }, { id: 'science-fiction', label: 'Science Fiction' },
      { id: 'talk', label: 'Talk' }, { id: 'news', label: 'News' }, { id: 'adult', label: 'Adult' }, { id: 'horror', label: 'Horror' }])).toEqual([
      { id: 'science-fiction', label: 'Science Fiction', minor: false },
      { id: 'talk-show', label: 'Talk-Show', minor: true },
      { id: 'news', label: 'News', minor: true },
      { id: 'horror', label: 'Horror', minor: false },
    ]);
  });

  it('expands a canonical filter to every source genre that maps to it', () => {
    expect(genre_sources('science-fiction').sort()).toEqual(['sci-fi', 'sci-fi-fantasy', 'science-fiction']);
    expect(genre_sources('action').sort()).toEqual(['action', 'action-adventure']);
    expect(genre_sources('horror')).toEqual(['horror']);
  });
});
