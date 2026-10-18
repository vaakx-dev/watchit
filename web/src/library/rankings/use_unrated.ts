import { use_resource } from '../../catalog/api';
import type { CatalogKind } from '../../catalog/types';
import type { UnratedTitles } from '../types';
import type { Library } from '../use_library';

export function use_unrated(kind: CatalogKind, library: Library, { cache = true } = {}) {
  const { resource, retry } = use_resource<UnratedTitles>(`/api/rankings/unrated?kind=${kind}`, { cache });
  const error = resource.status === 'error' ? resource.error : undefined;
  if (resource.status !== 'ready') return { titles: null, error, retry };
  const titles = resource.data.titles.filter(title => {
    const entry = library.entries[title.id];
    return !library.ready || (entry?.status === 'watched' && entry.rating === null);
  });
  return { titles, error, retry };
}
