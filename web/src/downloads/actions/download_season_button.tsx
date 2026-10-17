import { add_season } from '../../torrents/api';
import { use_transfers } from '../../torrents/transfer_store';
import { use_add_download } from '../../torrents/use_add_download';
import { Icon } from '../../ui/icon';

export function DownloadSeasonButton({ series_id, season }: { series_id: string; season: number }) {
  const { transfers } = use_transfers();
  const { pending, error, run } = use_add_download(add_season);
  const prefix = `${series_id}:${season}:`;
  const downloading = transfers.some(transfer => transfer.kind === 'download'
    && (transfer.title_id.startsWith(prefix) || transfer.files.some(file => file.title_id?.startsWith(prefix))));

  if (downloading) return <a className="button ghost small" href="#/downloads"><Icon name="download" />In downloads</a>;
  return <button type="button" className="button ghost small" disabled={pending} title={error ?? undefined} onClick={() => { void run(series_id, season); }}>
    <Icon name="download" />{pending ? 'Finding torrents…' : error ? 'Download failed, retry' : 'Download season'}
  </button>;
}
