import { bytes } from '../../torrents/format';
import type { Deletion } from '../menu/delete_dialog';
import type { EpisodeCopy } from '../downloaded/library_groups';
import { count } from '../downloaded/show_summary';
import { DownloadRow } from '../row/download_row';
import { PlayLink } from '../row/play_link';
import { present, StatusText } from '../row/status_text';
import { episode_ids, use_title, watch_href } from '../titles';

function deletion(copy: EpisodeCopy, name: string): Deletion {
  const transfers = [copy.transfer];
  if (!copy.pack) return { heading: `Delete “${name}”?`, body: `This deletes ${bytes(copy.size)} of downloaded files from this server.`, transfers };
  const episodes = count(episode_ids(copy.transfer).length, 'episode', 'episodes');
  return {
    heading: 'Delete the whole season pack?',
    body: `“${name}” was downloaded as part of a season pack, so deleting it removes the pack: ${episodes}, ${bytes(copy.transfer.size_bytes)}.`,
    transfers,
  };
}

export function EpisodeRow({ copy, artwork }: { copy: EpisodeCopy; artwork: string }) {
  const title = use_title(copy.id);
  const name = title?.title ?? copy.name;
  const size = bytes(copy.size);
  const parts = present([title?.minutes ? `${title.minutes} min` : null, size]);

  return <DownloadRow
    lead={<span className="download-number">{copy.episode}</span>}
    name={name}
    sub={<StatusText narrow={parts} />}
    trailing={() => <PlayLink href={watch_href(copy.id)} name={name} />}
    menu={{
      heading: { artwork, name, detail: `S${copy.season} E${copy.episode} · ${size}` },
      controls: null,
      replace: copy.transfer,
      deletion: deletion(copy, name),
    }} />;
}
