import { add_season, search_url } from '../../torrents/api';
import type { TorrentResult, Transfer } from '../../torrents/types';
import { download_file } from '../../torrents/use_add_download';
import { SourcePicker } from '../picker/source_picker';
import { episode_ids, episode_number, series_id } from '../titles';
import { delete_downloads } from './delete_dialog';

function pack_season(transfer: Transfer) {
  const ids = episode_ids(transfer);
  const seasons = new Set(ids.map(id => episode_number(id).season));
  const [season] = seasons;
  return ids.length > 1 && seasons.size === 1 ? season ?? null : null;
}

async function replaced(transfer: Transfer, added: Transfer | Transfer[]) {
  const list = Array.isArray(added) ? added : [added];
  if (!list.some(item => item.id === transfer.id)) await delete_downloads([transfer]);
  return added;
}

export function ReplaceSource({ transfer, heading, on_close }: { transfer: Transfer; heading: string; on_close: () => void }) {
  const season = pack_season(transfer);
  const series = series_id(transfer.title_id);

  if (season !== null) {
    return <SourcePicker heading={heading} season on_close={on_close}
      url={unfiltered => search_url(series, { season, unfiltered })}
      start={async (result, notify_when_ready) => replaced(transfer, await add_season(series, season, { info_hash: result?.info_hash, notify_when_ready }))} />;
  }

  async function start(result: TorrentResult | null, notify_when_ready: boolean) {
    if (!result) throw new Error('No torrents were found for this title.');
    return replaced(transfer, await download_file(result.info_hash, result.file_index, transfer.title_id, notify_when_ready));
  }

  return <SourcePicker heading={heading} season={false} on_close={on_close} url={unfiltered => search_url(transfer.title_id, { unfiltered })} start={start} />;
}
