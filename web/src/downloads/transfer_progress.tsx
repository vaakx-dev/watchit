import type { CSSProperties } from 'react';
import { ArrowDown, ArrowUp, Clock, Users } from 'lucide-react';
import { bytes, eta, percent, speed } from '../torrents/format';
import type { Transfer } from '../torrents/types';
import { STATE_LABELS } from './states';

export function ProgressBar({ transfer }: { transfer: Transfer }) {
  return <div className="transfer-progress" data-state={transfer.state} role="progressbar" aria-label={`${transfer.name} progress`}
    aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.floor(transfer.progress * 100)}>
    <span style={{ '--progress': `${transfer.progress * 100}%` } as CSSProperties} />
  </div>;
}

export function TransferStats({ transfer }: { transfer: Transfer }) {
  if (transfer.state === 'error') return <p className="transfer-failure" role="alert">{transfer.error ?? 'This download failed.'}</p>;
  const active = transfer.state === 'downloading' || transfer.state === 'metadata';
  return <p className="meta transfer-stats">
    <span>{STATE_LABELS[transfer.state]}</span>
    <span>{percent(transfer.progress)} of {bytes(transfer.size_bytes)}</span>
    {active && <span><ArrowDown />{speed(transfer.download_bps)}</span>}
    {transfer.upload_bps > 0 && <span><ArrowUp />{speed(transfer.upload_bps)}</span>}
    {active && transfer.eta_seconds !== null && <span><Clock />{eta(transfer.eta_seconds)} left</span>}
    {active && <span><Users />{transfer.peers} {transfer.peers === 1 ? 'peer' : 'peers'}</span>}
    {transfer.error && <span className="transfer-failure">{transfer.error}</span>}
  </p>;
}
