import { bytes, percent } from './format';
import type { TorrentStatus } from './types';

export function TorrentStatusLine({ status }: { status: TorrentStatus | null }) {
  if (!status) return null;
  return <p className="meta torrent-status" aria-label="Download status">
    <span>{status.peers} {status.peers === 1 ? 'peer' : 'peers'}</span>
    <span>{bytes(status.download_speed)}/s</span>
    <span>{percent(status.progress)} downloaded{status.length ? ` of ${bytes(status.length)}` : ''}</span>
  </p>;
}
