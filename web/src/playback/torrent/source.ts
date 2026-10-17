import { TITLE_ID } from '../../catalog/identity';
import type { Title } from '../../catalog/types';

export const TORRENT_SOURCE = { id: 'torrent', name: 'Torrent' } as const;

export function torrent_searchable(title: Pick<Title, 'id' | 'kind'>) {
  return title.kind !== 'series' && TITLE_ID.test(title.id);
}
