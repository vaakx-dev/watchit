import type { CSSProperties } from 'react';
import { bytes, eta, percent, speed } from '../torrents/format';
import type { Transfer } from '../torrents/types';
import { Icon } from '../ui/icon';
import { finished, STATE_LABELS } from './states';
import { TransferActions } from './transfer_actions';

function episode_label(title_id: string) {
  const [, season, episode] = title_id.split(':');
  return season && episode ? `S${season} E${episode}` : null;
}

function Stats({ transfer }: { transfer: Transfer }) {
  if (transfer.state === 'error') return <p className="transfer-failure">{transfer.error ?? 'This download failed.'}</p>;
  const active = !finished(transfer) && transfer.state !== 'paused';
  return <p className="meta transfer-stats">
    <span>{STATE_LABELS[transfer.state]}</span>
    <span>{percent(transfer.progress)}{finished(transfer) ? '' : ` of ${bytes(transfer.size_bytes)}`}</span>
    {finished(transfer) && <span>{bytes(transfer.size_bytes)}</span>}
    {active && <span><Icon name="arrow-down" size={12} />{speed(transfer.download_bps)}</span>}
    {transfer.upload_bps > 0 && <span><Icon name="arrow-up" size={12} />{speed(transfer.upload_bps)}</span>}
    {active && transfer.eta_seconds !== null && <span><Icon name="clock" size={12} />{eta(transfer.eta_seconds)}</span>}
    {(active || transfer.state === 'seeding') && <span><Icon name="peers" size={12} />{transfer.peers} {transfer.peers === 1 ? 'peer' : 'peers'}</span>}
  </p>;
}

export function TransferRow({ transfer, on_remove }: { transfer: Transfer; on_remove: () => void }) {
  const episode = episode_label(transfer.title_id);
  const playable = transfer.progress > 0 && transfer.state !== 'error';
  return <li className="transfer-row" data-state={transfer.state}>
    <div className="transfer-copy">
      <h3>
        {episode && <span className="transfer-episode">{episode}</span>}
        <span className="transfer-name">{transfer.name}</span>
        {transfer.kind === 'stream' && <span className="transfer-kind">Streaming</span>}
      </h3>
      <Stats transfer={transfer} />
      {!finished(transfer) && transfer.state !== 'error' && <div className="transfer-progress" role="progressbar" aria-label={`${transfer.name} progress`}
        aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.floor(transfer.progress * 100)}>
        <span style={{ '--progress': `${transfer.progress * 100}%` } as CSSProperties} />
      </div>}
    </div>
    {playable && <a className="icon-button small" href={`#/watch/${transfer.title_id}`} aria-label={`Play ${transfer.name}`} title="Play"><Icon name="play" /></a>}
    <TransferActions transfer={transfer} on_remove={on_remove} />
  </li>;
}
