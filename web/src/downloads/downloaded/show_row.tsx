import { ChevronRight } from 'lucide-react';
import { bytes } from '../../torrents/format';
import { DownloadRow } from '../row/download_row';
import { Poster } from '../row/poster';
import { StatusText } from '../row/status_text';
import { use_title_details } from '../titles';
import type { ShowGroup } from './library_groups';
import { episode_count, season_count } from './show_summary';

export function ShowRow({ show }: { show: ShowGroup }) {
  const title = use_title_details(show.id);
  const name = title?.title ?? show.transfers[0]?.name ?? show.id;
  const href = `#/downloads/${show.id}`;
  const episodes = episode_count(show);
  const size = bytes(show.size);

  return <DownloadRow
    lead={<Poster src={title?.artwork ?? ''} name={name} href={href} />}
    name={<a href={href}>{name}</a>}
    sub={<StatusText narrow={[episodes, season_count(show), size]} wide={[episodes, season_count(show)]} />}
    meta={size}
    trailing={() => <a className="download-open" href={href} aria-label={`Open ${name}`} title="Open"><ChevronRight /></a>}
    menu={{
      heading: { artwork: title?.artwork ?? '', name, detail: `${episodes} · ${size}` },
      controls: null,
      replace: null,
      deletion: { heading: `Delete all of “${name}”?`, body: `This deletes ${episodes} (${size}) from this server.`, transfers: show.transfers },
    }} />;
}
