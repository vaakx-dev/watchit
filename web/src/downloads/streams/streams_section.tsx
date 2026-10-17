import { Artwork } from '../../catalog/components/artwork';
import type { Transfer } from '../../torrents/types';
import { finished } from '../states';
import { use_transfer_title } from '../titles';
import { TransferActions } from '../transfer_actions';
import { ProgressBar, TransferStats } from '../transfer_progress';
import { bytes } from '../../torrents/format';

function StreamRow({ transfer, on_remove }: { transfer: Transfer; on_remove: () => void }) {
  const { title, name, episode } = use_transfer_title(transfer);
  const done = finished(transfer);
  return <li className="stream-row">
    <div className="queue-poster"><Artwork src={title?.artwork ?? ''} /></div>
    <div className="stream-copy">
      <p className="queue-name">{episode && <strong>{episode}</strong>}<span>{name}</span></p>
      {done ? <p className="meta"><span>Fully cached</span><span>{bytes(transfer.size_bytes)}</span></p> : <TransferStats transfer={transfer} />}
      {!done && transfer.state !== 'error' && <ProgressBar transfer={transfer} />}
    </div>
    <TransferActions transfer={transfer} on_remove={on_remove} />
  </li>;
}

export function StreamsSection({ transfers, on_remove }: { transfers: Transfer[]; on_remove: (transfer: Transfer) => void }) {
  if (!transfers.length) return null;
  return <section className="downloads-section" aria-labelledby="streams-heading">
    <header className="downloads-section-head">
      <h2 id="streams-heading">Streams</h2>
      <p className="meta">Cached while you watch. Keep one to add it to your downloads.</p>
    </header>
    <ul className="stream-list">
      {transfers.map(transfer => <StreamRow key={transfer.id} transfer={transfer} on_remove={() => on_remove(transfer)} />)}
    </ul>
  </section>;
}
