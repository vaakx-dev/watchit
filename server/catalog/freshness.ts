import type { MediaKind } from '../../src/catalog/types.ts';
import type { Store } from '../storage/types.ts';

export const DETAIL_KEY = 'cinemeta:detail:v1:';
export type Detail = { kind: MediaKind; verified_at: number };

export function detail_fresh(store: Store, id: string, request: 'title' | 'episodes' = 'title'): boolean {
  const marker = store.cache_get<Detail>(`${DETAIL_KEY}${id}`);
  if (!marker || (request === 'episodes' && marker.value.kind !== 'series')) return false;
  const title = store.title_get(id)?.value;
  if (!title || title.kind !== marker.value.kind) return false;
  if (title.kind !== 'episode' && !title.trailers) return false;
  const age = Date.now() - marker.value.verified_at;
  return age >= 0 && age < store.settings_get().metadata_hours * 3600000;
}
