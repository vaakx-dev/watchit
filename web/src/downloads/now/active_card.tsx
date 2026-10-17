import { Play } from 'lucide-react';
import { Artwork } from '../../catalog/components/artwork';
import type { Transfer } from '../../torrents/types';
import { ReadinessNote } from '../readiness/readiness_note';
import { use_transfer_title, watch_href } from '../titles';
import { TransferActions } from '../transfer_actions';
import { ProgressBar, TransferStats } from '../transfer_progress';

export function ActiveCard({ transfer, on_remove }: { transfer: Transfer; on_remove: () => void }) {
  const { id, title, name, episode } = use_transfer_title(transfer);
  const ready = transfer.readiness.state === 'ready';
  const playable = transfer.progress > 0 && transfer.state !== 'error';

  return <li className="active-card" data-state={transfer.state}>
    <a className="active-art" href={`#/title/${id}`} tabIndex={-1} aria-hidden="true">
      <Artwork src={title?.backdrop || title?.artwork || ''} label={name} />
    </a>
    <div className="active-body">
      <div className="active-head">
        <h3><a href={`#/title/${id}`}>{name}</a>{episode && <span className="transfer-episode">{episode}</span>}</h3>
        <p className="transfer-release" title={transfer.name}>{transfer.name}</p>
      </div>
      <ProgressBar transfer={transfer} />
      <TransferStats transfer={transfer} />
      <ReadinessNote transfer={transfer} />
    </div>
    <div className="active-actions">
      {playable && <a className={`button small ${ready ? 'primary' : 'secondary'}`} href={watch_href(transfer.title_id)}>
        <Play fill="currentColor" />{ready ? 'Watch now' : 'Play'}
      </a>}
      <TransferActions transfer={transfer} on_remove={on_remove} />
    </div>
  </li>;
}
