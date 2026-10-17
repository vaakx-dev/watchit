import type { CSSProperties } from 'react';
import { bytes, eta, percent, speed } from '../torrents/format';
import type { Transfer } from '../torrents/types';
import { ArrowDown, ArrowUp, Clock, Folder, Play, Users } from 'lucide-react';
import { finished, STATE_LABELS } from './states';
import { ReadinessNote } from './readiness/readiness_note';
import { TransferActions } from './transfer_actions';

function episode_label(transfer: Transfer) {
  const ids = transfer.files.length ? transfer.files.map(file => file.title_id ?? transfer.title_id) : [transfer.title_id];
  const episodes = new Set(ids.filter(id => id.includes(':')));
  const [only] = episodes;
  if (!only) return null;
  const seasons = new Set([...episodes].map(id => id.split(':')[1]));
  const [season] = seasons;
  if (episodes.size === 1) return `S${season} E${only.split(':')[2]}`;
  return seasons.size === 1 ? `S${season} · ${episodes.size} episodes` : `${episodes.size} episodes`;
}

function Stats({ transfer }: { transfer: Transfer }) {
  if (transfer.state === 'error') return <p className="transfer-failure">{transfer.error ?? 'This download failed.'}</p>;
  const active = !finished(transfer) && transfer.state !== 'paused' && transfer.state !== 'moving';
  return <p className="meta transfer-stats">
    <span>{STATE_LABELS[transfer.state]}{transfer.state === 'queued' && transfer.queue_position !== null && ` · #${transfer.queue_position + 1} in queue`}</span>
    <span>{percent(transfer.progress)}{finished(transfer) ? '' : ` of ${bytes(transfer.size_bytes)}`}</span>
    {finished(transfer) && <span>{bytes(transfer.size_bytes)}</span>}
    {active && <span><ArrowDown />{speed(transfer.download_bps)}</span>}
    {transfer.upload_bps > 0 && <span><ArrowUp />{speed(transfer.upload_bps)}</span>}
    {active && transfer.eta_seconds !== null && <span><Clock />{eta(transfer.eta_seconds)}</span>}
    {(active || transfer.state === 'seeding') && <span><Users />{transfer.peers} {transfer.peers === 1 ? 'peer' : 'peers'}</span>}
  </p>;
}

export function TransferRow({ transfer, on_remove }: { transfer: Transfer; on_remove: () => void }) {
  const episode = episode_label(transfer);
  const playable = transfer.progress > 0 && transfer.state !== 'error';
  return <li className="transfer-row" data-state={transfer.state}>
    <div className="transfer-copy">
      <h3>
        {episode && <span className="transfer-episode">{episode}</span>}
        <span className="transfer-name">{transfer.name}</span>
        {transfer.kind === 'stream' && <span className="transfer-kind">Streaming</span>}
      </h3>
      <Stats transfer={transfer} />
      <ReadinessNote transfer={transfer} />
      {transfer.error && transfer.state !== 'error' && <p className="transfer-failure">{transfer.error}</p>}
      <p className="meta transfer-location" title={transfer.download_dir}><Folder />{transfer.download_dir}</p>
      {!finished(transfer) && transfer.state !== 'error' && <div className="transfer-progress" role="progressbar" aria-label={`${transfer.name} progress`}
        aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.floor(transfer.progress * 100)}>
        <span style={{ '--progress': `${transfer.progress * 100}%` } as CSSProperties} />
      </div>}
    </div>
    {playable && <a className="icon-button small" href={`#/watch/${transfer.title_id}`} aria-label={`Play ${transfer.name}`} title="Play"><Play fill="currentColor" /></a>}
    <TransferActions transfer={transfer} on_remove={on_remove} />
  </li>;
}
