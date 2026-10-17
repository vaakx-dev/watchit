import { genre_id } from '../../src/catalog/identity.ts';
import type { GenreOption } from '../../src/catalog/types.ts';

const ALIASES: Record<string, string[]> = {
  'sci-fi': ['science-fiction'],
  'sci-fi-fantasy': ['science-fiction', 'fantasy'],
  'action-adventure': ['action', 'adventure'],
  'war-politics': ['war'],
  reality: ['reality-tv'],
  talk: ['talk-show'],
  kids: ['family'],
  adult: [],
};
const LABELS: Record<string, string> = {
  'science-fiction': 'Science Fiction', fantasy: 'Fantasy', action: 'Action', adventure: 'Adventure',
  war: 'War', 'reality-tv': 'Reality-TV', 'talk-show': 'Talk-Show', family: 'Family',
};
const MINOR = new Set(['reality-tv', 'talk-show', 'game-show', 'news', 'soap', 'tv-movie', 'short']);

export function genre_ids(id: string): string[] {
  return ALIASES[id] ?? [id];
}

export function genre_sources(id: string): string[] {
  return [id, ...Object.keys(ALIASES).filter(source => ALIASES[source]!.includes(id))];
}

export function genre_options(sources: readonly { id: string; label: string }[]): GenreOption[] {
  const options = new Map<string, GenreOption>();
  for (const source of sources) {
    for (const id of genre_ids(source.id)) {
      if (!options.has(id)) options.set(id, { id, label: LABELS[id] ?? source.label, minor: MINOR.has(id) });
    }
  }
  return [...options.values()];
}

export function genre_labels(labels: readonly string[]): string[] {
  return genre_options(labels.map(label => ({ id: genre_id(label), label }))).map(option => option.label);
}
