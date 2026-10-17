import { useState } from 'react';
import type { Title } from '../../catalog/types';
import { search_url } from '../../torrents/api';
import { percent } from '../../torrents/format';
import { transfers_for, use_transfers } from '../../torrents/transfer_store';
import { download_file } from '../../torrents/use_add_download';
import { ArrowDownToLine, Check } from 'lucide-react';
import { SourcePicker, type StartDownload } from '../picker/source_picker';

export function DownloadTitleButton({ title }: { title: Title }) {
  const { transfers } = use_transfers();
  const [picking, set_picking] = useState(false);
  const download = transfers_for(transfers, title.id).find(transfer => transfer.kind === 'download');

  const start: StartDownload = async (result, notify) => {
    if (!result) throw new Error('No torrents were found for this title.');
    return download_file(result.info_hash, result.file_index, title.id, notify);
  };

  if (download) return <a className="button secondary" href="#/downloads">
    {download.progress >= 1 ? <Check /> : <ArrowDownToLine />}{download.progress >= 1 ? 'Downloaded' : `Downloading ${percent(download.progress)}`}
  </a>;
  return <>
    <button type="button" className="button secondary" aria-haspopup="dialog" onClick={() => set_picking(true)}><ArrowDownToLine />Download</button>
    {picking && <SourcePicker heading={title.title} url={unfiltered => search_url(title.id, { unfiltered })} season={false} start={start} on_close={() => set_picking(false)} />}
  </>;
}
