import { useState } from 'react';
import { add_season, search_url } from '../../torrents/api';
import { use_transfers } from '../../torrents/transfer_store';
import { use_add_download } from '../../torrents/use_add_download';
import { notify_wanted } from '../notify/notify_choice';
import { SourcePicker, type StartDownload } from '../picker/source_picker';

export function use_season_download(series: { id: string; title: string }, season: number) {
  const { transfers } = use_transfers();
  const [picking, set_picking] = useState(false);
  const prefix = `${series.id}:${season}:`;
  const downloading = transfers.some(transfer => transfer.kind === 'download'
    && (transfer.title_id.startsWith(prefix) || transfer.files.some(file => file.title_id?.startsWith(prefix))));

  const start: StartDownload = (result, notify_when_ready) =>
    add_season(series.id, season, { info_hash: result?.info_hash, notify_when_ready });
  const best = use_add_download(start);

  const picker = picking && <SourcePicker heading={`${series.title} · Season ${season}`} url={unfiltered => search_url(series.id, { season, unfiltered })}
    season start={start} on_close={() => set_picking(false)} />;

  return {
    season,
    downloading,
    pending: best.pending,
    error: best.error,
    download_best: () => { void best.run(null, notify_wanted()); },
    pick: () => set_picking(true),
    picker,
  };
}

export type SeasonDownloadState = ReturnType<typeof use_season_download>;
