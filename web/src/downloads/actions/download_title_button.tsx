import { ArrowDownToLine, Check } from 'lucide-react';
import type { CatalogEntry } from '../../catalog/types';
import { percent } from '../../torrents/format';
import { use_best_source } from './best_source';
import { use_title_download } from './use_title_download';

export function DownloadTitleButton({ title }: { title: CatalogEntry }) {
  const { download, pick, picker } = use_title_download(title);
  const source = use_best_source(download ? null : title.id);

  if (download) return <a className="button secondary wide" href="#/downloads">
    {download.progress >= 1 ? <Check /> : <ArrowDownToLine />}{download.progress >= 1 ? 'Downloaded' : `Downloading ${percent(download.progress)}`}
  </a>;
  return <>
    <button type="button" className="button secondary wide" aria-haspopup="dialog" onClick={pick}>
      <ArrowDownToLine />Download{source && <span className="button-detail">· {source}</span>}
    </button>
    {picker}
  </>;
}
