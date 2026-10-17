import { ArrowDownToLine, Check } from 'lucide-react';
import { FolderButton } from '../downloads/locations/folder_button';
import { percent } from './format';
import { use_transfers } from './transfer_store';
import type { TorrentResult } from './types';
import { download_file, use_add_download } from './use_add_download';

export function DownloadResultButton({ result, title_id }: { result: TorrentResult; title_id: string }) {
  const { transfers } = use_transfers();
  const { pending, error, run } = use_add_download(download_file);
  const transfer = transfers.find(item => item.info_hash === result.info_hash && item.kind === 'download');
  const downloaded = transfer !== undefined && transfer.progress >= 1;
  const label = downloaded ? 'Downloaded' : transfer ? `Downloading, ${percent(transfer.progress)}` : error ? `Download failed: ${error}` : 'Download';

  const locked = pending || Boolean(transfer);
  return <>
    <button type="button" className="icon-button small ghost source-download" aria-label={label} title={label}
      disabled={locked} data-failed={error ? true : undefined}
      onClick={() => { void run(result.info_hash, result.file_index, title_id); }}>
      {downloaded ? <Check /> : <ArrowDownToLine />}
    </button>
    <FolderButton label="Download to a folder" confirm="Download here" series={title_id.includes(':')} disabled={locked}
      on_pick={folder => { void run(result.info_hash, result.file_index, title_id, folder); }} />
  </>;
}
