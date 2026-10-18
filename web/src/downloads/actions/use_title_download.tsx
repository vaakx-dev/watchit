import { useState } from 'react';
import type { CatalogEntry } from '../../catalog/types';
import { search_url } from '../../torrents/api';
import { transfers_for, use_transfers } from '../../torrents/transfer_store';
import { download_file } from '../../torrents/use_add_download';
import { SourcePicker, type StartDownload } from '../picker/source_picker';

export function use_title_download(title: CatalogEntry) {
  const { transfers } = use_transfers();
  const [picking, set_picking] = useState(false);
  const download = transfers_for(transfers, title.id).find(transfer => transfer.kind === 'download');

  const start: StartDownload = async (result, notify) => {
    if (!result) throw new Error('No torrents were found for this title.');
    return download_file(result.info_hash, result.file_index, title.id, notify);
  };

  const picker = picking && <SourcePicker heading={title.title} url={unfiltered => search_url(title.id, { unfiltered })} season={false}
    start={start} on_close={() => set_picking(false)} />;
  return { download, pick: () => set_picking(true), picker };
}
