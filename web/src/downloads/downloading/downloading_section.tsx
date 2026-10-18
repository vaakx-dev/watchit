import { useState } from 'react';
import { error_message } from '../../catalog/client';
import type { Transfer } from '../../torrents/types';
import { DragHandle } from '../queue/drag_handle';
import { move_to, moved } from '../queue/queue_order';
import { use_drag_order } from '../queue/use_drag_order';
import { DownloadingRow } from './downloading_row';
import '../queue/queue.css';

function waiting_places(transfers: readonly Transfer[]) {
  const places = new Map<string, number>();
  for (const transfer of transfers) if (transfer.state === 'queued') places.set(transfer.id, places.size + 1);
  return places;
}

export function DownloadingSection({ transfers }: { transfers: Transfer[] }) {
  const [editing, set_editing] = useState(false);
  const [pending, set_pending] = useState<string[] | null>(null);
  const [failure, set_failure] = useState('');
  const reordering = editing && transfers.length > 1;

  function move(from: number, to: number) {
    const transfer = transfers[from];
    const target = transfers[to];
    if (!transfer || !target) return;
    set_pending(moved(transfers, from, to).map(item => item.id));
    set_failure('');
    move_to(transfer, target.queue_position ?? to)
      .catch((cause: unknown) => set_failure(error_message(cause, 'Could not reorder.')))
      .finally(() => set_pending(null));
  }

  const { list, drag, handle } = use_drag_order(move);
  const order = drag ? moved(transfers, drag.from, drag.to)
    : pending ? pending.flatMap(id => transfers.filter(transfer => transfer.id === id)) : transfers;
  const places = waiting_places(transfers);
  if (!transfers.length) return null;

  return <section className="downloads-section" aria-labelledby="downloading-heading">
    <header className="downloads-heading">
      <h2 id="downloading-heading">Downloading</h2>
      {transfers.length > 1 && <button type="button" className="downloads-link" aria-pressed={reordering} onClick={() => set_editing(!reordering)}>
        {reordering ? 'Done' : 'Edit'}
      </button>}
    </header>
    {failure && <p role="alert" className="downloads-failure">{failure}</p>}
    <ol className="download-list" ref={list}>
      {order.map((transfer, index) => {
        const from = transfers.indexOf(transfer);
        return <DownloadingRow key={transfer.id} transfer={transfer} place={places.get(transfer.id) ?? null}
          reorder={reordering ? {
            dragging: drag !== null && transfers[drag.from]?.id === transfer.id,
            handle: <DragHandle name={transfer.name} index={index} count={order.length} events={handle(from)} on_move={to => move(from, to)} />,
          } : undefined} />;
      })}
    </ol>
  </section>;
}
