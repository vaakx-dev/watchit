import type { Transfer } from '../../torrents/types';
import { ActiveCard } from './active_card';

export function NowSection({ transfers, on_remove }: { transfers: Transfer[]; on_remove: (transfer: Transfer) => void }) {
  return <section className="downloads-section" aria-labelledby="now-heading">
    <h2 id="now-heading">Downloading</h2>
    {transfers.length ? <ol className="active-list">
      {transfers.map(transfer => <ActiveCard key={transfer.id} transfer={transfer} on_remove={() => on_remove(transfer)} />)}
    </ol> : <p className="downloads-quiet">Nothing is downloading right now.</p>}
  </section>;
}
