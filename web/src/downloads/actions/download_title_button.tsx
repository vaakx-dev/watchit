import { request } from '../../catalog/client';
import type { Title } from '../../catalog/types';
import { search_url } from '../../torrents/api';
import { percent } from '../../torrents/format';
import { transfers_for, use_transfers } from '../../torrents/transfer_store';
import type { TorrentResult } from '../../torrents/types';
import { download_file, use_add_download } from '../../torrents/use_add_download';
import { Icon } from '../../ui/icon';

async function download_best(title_id: string) {
  const { results } = await request<{ results: TorrentResult[] }>(search_url(title_id));
  const best = results[0];
  if (!best) throw new Error('No torrents were found for this title.');
  return download_file(best.info_hash, best.file_index, title_id);
}

export function DownloadTitleButton({ title }: { title: Title }) {
  const { transfers } = use_transfers();
  const { pending, error, run } = use_add_download(download_best);
  const download = transfers_for(transfers, title.id).find(transfer => transfer.kind === 'download');

  if (download) return <a className="button secondary" href="#/downloads">
    <Icon name={download.progress >= 1 ? 'check' : 'download'} />{download.progress >= 1 ? 'Downloaded' : `Downloading ${percent(download.progress)}`}
  </a>;
  return <button type="button" className="button secondary" disabled={pending} title={error ?? undefined} onClick={() => { void run(title.id); }}>
    <Icon name="download" />{pending ? 'Finding a torrent…' : error ? 'Download failed, retry' : 'Download'}
  </button>;
}
