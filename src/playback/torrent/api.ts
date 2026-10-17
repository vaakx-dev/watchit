import type { TorrentResult } from './types';

export function search_url(title_id: string) {
  return `/api/torrents/search?title=${encodeURIComponent(title_id)}`;
}

export function torrent_url(result: TorrentResult, action: 'status' | 'play') {
  return `/api/torrents/${encodeURIComponent(result.info_hash)}/${encodeURIComponent(result.file)}/${action}`;
}

export function result_key(result: TorrentResult) {
  return `${result.info_hash}/${result.file}`;
}
