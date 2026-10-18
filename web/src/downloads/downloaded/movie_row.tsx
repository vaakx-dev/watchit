import { bytes } from '../../torrents/format';
import type { Transfer } from '../../torrents/types';
import { DownloadRow } from '../row/download_row';
import { PlayLink } from '../row/play_link';
import { Poster } from '../row/poster';
import { present, StatusText } from '../row/status_text';
import { use_quality, use_transfer_title } from '../titles';

export function MovieRow({ transfer }: { transfer: Transfer }) {
  const { id, title, name } = use_transfer_title(transfer);
  const quality = use_quality(transfer);
  const href = `#/title/${id}`;
  const year = title?.year ? String(title.year) : null;
  const size = bytes(transfer.size_bytes);

  return <DownloadRow
    lead={<Poster src={title?.artwork ?? ''} name={name} href={href} />}
    name={<a href={href}>{name}</a>}
    sub={<StatusText narrow={present([year, size])} wide={present([year, quality])} />}
    meta={size}
    trailing={() => <PlayLink href={`#/watch/${transfer.title_id}`} name={name} />}
    menu={{
      heading: { artwork: title?.artwork ?? '', name, detail: present([quality, size]).join(' · ') },
      controls: null,
      replace: transfer,
      deletion: { heading: `Delete “${name}”?`, body: `This deletes ${size} of downloaded files from this server.`, transfers: [transfer] },
    }} />;
}
