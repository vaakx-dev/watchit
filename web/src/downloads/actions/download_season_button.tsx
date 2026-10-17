import { useState } from 'react';
import { add_season, search_url } from '../../torrents/api';
import { use_transfers } from '../../torrents/transfer_store';
import { ArrowDownToLine } from 'lucide-react';
import { SourcePicker, type StartDownload } from '../picker/source_picker';

export function DownloadSeasonButton({ series_id, series_title, season }: { series_id: string; series_title: string; season: number }) {
  const { transfers } = use_transfers();
  const [picking, set_picking] = useState(false);
  const prefix = `${series_id}:${season}:`;
  const downloading = transfers.some(transfer => transfer.kind === 'download'
    && (transfer.title_id.startsWith(prefix) || transfer.files.some(file => file.title_id?.startsWith(prefix))));

  const start: StartDownload = (result, notify_when_ready) =>
    add_season(series_id, season, { info_hash: result?.info_hash, notify_when_ready });

  if (downloading) return <a className="button ghost small" href="#/downloads"><ArrowDownToLine />In downloads</a>;
  return <>
    <button type="button" className="button ghost small" aria-haspopup="dialog" onClick={() => set_picking(true)}><ArrowDownToLine />Download season</button>
    {picking && <SourcePicker heading={`${series_title} · Season ${season}`} url={search_url(series_id, season)} season start={start}
      on_close={() => set_picking(false)} />}
  </>;
}
