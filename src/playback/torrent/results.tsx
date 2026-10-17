import { Icon } from '../../ui/icon';
import { result_key } from './api';
import type { Torrent } from './use_torrent';

export function TorrentResults({ torrent }: { torrent: Torrent }) {
  if (torrent.failure) return <div className="watch-note" role="alert">
    Torrent search failed: {torrent.failure} <button className="button ghost small" onClick={torrent.retry}>Try again</button>
  </div>;
  if (!torrent.results?.length) return null;
  const selected = torrent.selected ? result_key(torrent.selected) : null;

  return <section className="torrent-results" aria-label="Torrents">
    <ol className="torrent-list">{torrent.results.map(result => {
      const key = result_key(result);
      return <li key={key}>
        <button type="button" className="torrent-stream" aria-current={key === selected ? 'true' : undefined} onClick={() => torrent.choose(result)}>
          <span className="torrent-quality">{result.quality ?? result.name}</span>
          <span className="torrent-description">{result.title}</span>
          <Icon name="play" className="torrent-play" />
        </button>
      </li>;
    })}</ol>
  </section>;
}
