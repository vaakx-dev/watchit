import { ArrowDownToLine, Check } from 'lucide-react';
import { bytes, percent } from '../../torrents/format';
import { language_name } from '../../torrents/filters/language_name';
import { resolution_label } from '../../torrents/quality';
import { use_transfers } from '../../torrents/transfer_store';
import type { TorrentResult } from '../../torrents/types';
import { ReadinessNote } from '../readiness/readiness_note';

type Props = { result: TorrentResult; season: boolean; disabled: boolean; on_download: () => void };

function seeders(count: number | null) {
  return count === null ? null : `${count.toLocaleString()} ${count === 1 ? 'seeder' : 'seeders'}`;
}

export function PickerRow({ result, season, disabled, on_download }: Props) {
  const { transfers } = use_transfers();
  const transfer = transfers.find(item => item.info_hash === result.info_hash);
  const downloading = transfer?.kind === 'download';
  const details = [
    seeders(result.seeders),
    result.size_bytes !== null && bytes(result.size_bytes),
    result.video_codec,
    result.audio,
    result.site,
    result.languages.map(language_name).join(' / '),
    downloading && (transfer.progress >= 1 ? 'Downloaded' : `Downloading ${percent(transfer.progress)}`),
  ].filter(Boolean);
  const label = downloading ? 'Already in downloads' : 'Download this source';

  return <li className="picker-row">
    <span className="source-quality">
      <strong>{resolution_label(result.resolution) ?? 'Unknown'}</strong>
      {result.hdr.map(format => <span key={format} className="source-hdr">{format}</span>)}
    </span>
    <span className="source-copy">
      <span className="source-name">{result.name}</span>
      {result.filename && result.filename !== result.name && <span className="picker-file">{result.filename}</span>}
      {season && <span className="picker-badge" data-pack={result.season_pack}>{result.season_pack ? 'Season pack' : 'Single episode'}</span>}
      {transfer && <ReadinessNote transfer={transfer} />}
      {details.length > 0 && <span className="meta">{details.map(item => <span key={String(item)}>{item}</span>)}</span>}
    </span>
    <button type="button" className="icon-button small" aria-label={label} title={label} disabled={disabled || downloading} onClick={on_download}>
      {downloading ? <Check /> : <ArrowDownToLine />}
    </button>
  </li>;
}
