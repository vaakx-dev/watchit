import { request } from '../../catalog/client';
import type { Title } from '../../catalog/types';
import { search_url } from '../../torrents/api';
import { percent } from '../../torrents/format';
import { transfers_for, use_transfers } from '../../torrents/transfer_store';
import type { TorrentResult } from '../../torrents/types';
import { download_file, use_add_download } from '../../torrents/use_add_download';
import { ArrowDownToLine, Check } from 'lucide-react';
import { FolderButton } from '../locations/folder_button';

async function download_best(title_id: string, download_dir?: string) {
  const { results } = await request<{ results: TorrentResult[] }>(search_url(title_id));
  const best = results[0];
  if (!best) throw new Error('No torrents were found for this title.');
  return download_file(best.info_hash, best.file_index, title_id, download_dir);
}

export function DownloadTitleButton({ title }: { title: Title }) {
  const { transfers } = use_transfers();
  const { pending, error, run } = use_add_download(download_best);
  const download = transfers_for(transfers, title.id).find(transfer => transfer.kind === 'download');

  if (download) return <a className="button secondary" href="#/downloads">
    {download.progress >= 1 ? <Check /> : <ArrowDownToLine />}{download.progress >= 1 ? 'Downloaded' : `Downloading ${percent(download.progress)}`}
  </a>;
  return <>
    <button type="button" className="button secondary" disabled={pending} title={error ?? undefined} onClick={() => { void run(title.id); }}>
      <ArrowDownToLine />{pending ? 'Finding a torrent…' : error ? 'Download failed, retry' : 'Download'}
    </button>
    <FolderButton label="Download to a folder" confirm="Download here" series={title.kind === 'series'} disabled={pending} on_pick={folder => { void run(title.id, folder); }} />
  </>;
}
