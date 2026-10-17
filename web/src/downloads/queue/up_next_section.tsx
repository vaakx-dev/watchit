import { useState } from 'react';
import type { Transfer } from '../../torrents/types';
import { move_to, moved } from './queue_order';
import { QueueRow } from './queue_row';
import { use_drag_order } from './use_drag_order';
import './queue.css';

export function UpNextSection({ line, on_remove }: { line: Transfer[]; on_remove: (transfer: Transfer) => void }) {
  const [pending, set_pending] = useState<string[] | null>(null);
  const [failure, set_failure] = useState('');

  function move(from: number, to: number) {
    const transfer = line[from];
    const target = line[to];
    if (!transfer || !target) return;
    set_pending(moved(line, from, to).map(item => item.id));
    set_failure('');
    move_to(transfer, to === 0 ? 0 : target.queue_position ?? to)
      .catch((cause: unknown) => set_failure(cause instanceof Error ? cause.message : 'Could not reorder.'))
      .finally(() => set_pending(null));
  }

  const { list, drag, handle } = use_drag_order(move);
  const order = drag ? moved(line, drag.from, drag.to) : pending
    ? pending.flatMap(id => line.filter(transfer => transfer.id === id)) : line;
  if (!line.length) return null;

  return <section className="downloads-section" aria-labelledby="queue-heading">
    <header className="downloads-section-head">
      <h2 id="queue-heading">Up next</h2>
      <p className="meta">Drag to reorder</p>
    </header>
    {failure && <p role="alert" className="transfer-error">{failure}</p>}
    <ol className="queue-list" ref={list}>
      {order.map((transfer, index) => <QueueRow key={transfer.id} transfer={transfer} index={index} last={order.length - 1}
        dragging={drag !== null && line[drag.from]?.id === transfer.id} handle={handle(line.indexOf(transfer))}
        on_move={to => move(line.indexOf(transfer), to)} on_remove={() => on_remove(transfer)} />)}
    </ol>
  </section>;
}
