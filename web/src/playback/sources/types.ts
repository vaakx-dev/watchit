import type { LocalFile, TorrentResult } from '../../torrents/types';
import type { Provider } from '../providers';

export type PlaySource =
  | { kind: 'local'; file: LocalFile }
  | { kind: 'torrent'; result: TorrentResult }
  | { kind: 'embed'; provider: Provider };

export const TORRENT_PREFERENCE = 'torrent';

export function source_key(source: PlaySource) {
  if (source.kind === 'local') return `local:${source.file.info_hash}/${source.file.file_index}`;
  if (source.kind === 'torrent') return `torrent:${source.result.info_hash}/${source.result.file_index ?? ''}`;
  return `embed:${source.provider.id}`;
}

export function preference(source: PlaySource) {
  return source.kind === 'embed' ? source.provider.id : TORRENT_PREFERENCE;
}
