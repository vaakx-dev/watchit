import type { Torrent } from './use_torrent';
import { TorrentVideo } from './video';

function message(torrent: Torrent) {
  if (torrent.failure) return 'Torrent search failed.';
  if (!torrent.results) return 'Searching for torrents…';
  if (!torrent.selected) return 'No torrents were found for this title.';
  if (torrent.opened?.failure) return `This torrent could not be played: ${torrent.opened.failure}`;
  return 'Starting the download…';
}

export function TorrentScreen({ torrent, label }: { torrent: Torrent; label: string }) {
  const stream = torrent.opened?.stream;
  if (stream) return <TorrentVideo key={stream.url} stream={stream} label={label} />;
  const failed = Boolean(torrent.failure || torrent.opened?.failure);
  return <p className="player-unavailable" role={failed ? 'alert' : 'status'}>{message(torrent)}</p>;
}
