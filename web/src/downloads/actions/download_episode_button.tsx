import { ArrowDownToLine, Check } from 'lucide-react';
import type { CatalogEntry } from '../../catalog/types';
import { percent } from '../../torrents/format';
import { use_title_download } from './use_title_download';

export function DownloadEpisodeButton({ episode }: { episode: CatalogEntry }) {
  const { download, pick, picker } = use_title_download(episode);

  if (download) {
    const label = download.progress >= 1 ? 'Downloaded' : `Downloading ${percent(download.progress)}`;
    return <a className="icon-button small ghost" href="#/downloads" aria-label={`${episode.title}: ${label}`} title={label}>
      {download.progress >= 1 ? <Check /> : <ArrowDownToLine />}
    </a>;
  }
  return <>
    <button type="button" className="icon-button small ghost" aria-haspopup="dialog" aria-label={`Download ${episode.title}`} title="Download" onClick={pick}>
      <ArrowDownToLine />
    </button>
    {picker}
  </>;
}
