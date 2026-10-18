import { bytes } from '../../torrents/format';
import type { Transfer } from '../../torrents/types';
import { DownloadRow, type Reorder } from '../row/download_row';
import { Poster } from '../row/poster';
import { present, StatusText } from '../row/status_text';
import { use_quality, use_transfer_title, watch_href } from '../titles';
import { ProgressRing } from './progress_ring';
import { QueueNumber } from '../queue/queue_number';
import { meta_lines, narrow_parts, wide_parts } from './status_parts';

function peers(count: number) {
  return count === 1 ? '1 peer' : `${count} peers`;
}

export function DownloadingRow({ transfer, place, reorder }: { transfer: Transfer; place: number | null; reorder?: Reorder }) {
  const { id, title, name, episode } = use_transfer_title(transfer);
  const quality = use_quality(transfer);
  const href = `#/title/${id}`;
  const label = episode ? `${name} ${episode}` : name;
  const detail = present([quality, bytes(transfer.size_bytes), transfer.state === 'downloading' && peers(transfer.peers)]).join(' · ');

  return <DownloadRow
    lead={<Poster src={title?.artwork ?? ''} name={name} href={href} />}
    name={<><a href={href}>{name}</a>{episode && <span className="download-episode">{episode}</span>}</>}
    sub={<StatusText narrow={narrow_parts(transfer, place)} wide={wide_parts(transfer, place, quality)} />}
    meta={meta_lines(transfer).map(line => <span key={line}>{line}</span>)}
    progress={transfer.state === 'queued' || transfer.state === 'error' ? undefined : transfer}
    trailing={run => {
      if (transfer.readiness.state === 'ready' && transfer.state !== 'error') return <a className="button primary small download-watch" href={watch_href(transfer.title_id)}>Watch</a>;
      if (transfer.state === 'queued' && place !== null) return <QueueNumber place={place} />;
      return <ProgressRing transfer={transfer} name={label} run={run} />;
    }}
    menu={{
      heading: { artwork: title?.artwork ?? '', name: label, detail },
      controls: transfer,
      replace: transfer,
      deletion: { heading: `Delete “${label}”?`, body: 'This stops the download and deletes what has been downloaded so far.', transfers: [transfer] },
    }}
    reorder={reorder} />;
}
