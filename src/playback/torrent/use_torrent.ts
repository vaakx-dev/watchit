import { use_torrent_search } from './use_torrent_search';
import { use_torrent_status } from './use_torrent_status';
import { use_torrent_stream } from './use_torrent_stream';

export function use_torrent(title_id: string | null) {
  const search = use_torrent_search(title_id);
  const opened = use_torrent_stream(search.selected);
  const status = use_torrent_status(search.selected);
  return { ...search, opened, status };
}

export type Torrent = ReturnType<typeof use_torrent>;
