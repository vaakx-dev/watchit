import { ArrowDownToLine, Check } from 'lucide-react';
import { percent } from './format';
import { use_transfers } from './transfer_store';
import type { TorrentResult } from './types';
import { download_file, use_add_download } from './use_add_download';

export function DownloadResultButton({ result, title_id }: { result: TorrentResult; title_id: string }) {
  const { transfers } = use_transfers();
  const { pending, error, run } = use_add_download(download_file);
  const transfer = transfers.find(item => item.info_hash === result.info_hash && item.kind === 'download');
  const label = transfer ? `Downloading, ${percent(transfer.progress)}` : error ? `Download failed: ${error}` : 'Download';

  return <button type="button" className="icon-button small ghost source-download" aria-label={label} title={label}
    disabled={pending || Boolean(transfer)} data-failed={error ? true : undefined}
    onClick={() => { void run(result.info_hash, result.file_index, title_id); }}>
    {transfer?.progress === 1 ? <Check /> : <ArrowDownToLine />}
  </button>;
}
