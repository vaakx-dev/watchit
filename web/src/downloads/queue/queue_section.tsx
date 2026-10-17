import { useCallback, useState } from 'react';
import type { Transfer } from '../../torrents/types';
import { describe, ParallelControl } from './parallel_control';
import { move_to, moved, queued } from './queue_order';
import { QueueRow } from './queue_row';
import { use_drag_order } from './use_drag_order';
import './queue.css';

export function QueueSection({ transfers }: { transfers: Transfer[] }) {
  const line = queued(transfers);
  const [max_active, set_max_active] = useState<number | null>(null);
  const [pending, set_pending] = useState<string[] | null>(null);
  const [failure, set_failure] = useState('');
  const on_change = useCallback((value: number) => set_max_active(value), []);

  function move(from: number, to: number) {
    const transfer = line[from];
    if (!transfer) return;
    set_pending(moved(line, from, to).map(item => item.id));
    set_failure('');
    move_to(transfer, to)
      .catch((cause: unknown) => set_failure(cause instanceof Error ? cause.message : 'Could not reorder.'))
      .finally(() => set_pending(null));
  }

  const { list, drag, handle } = use_drag_order(move);
  const order = drag ? moved(line, drag.from, drag.to) : pending
    ? pending.flatMap(id => line.filter(transfer => transfer.id === id)) : line;
  if (!line.length) return null;

  return <section className="queue-section" aria-labelledby="queue-heading">
    <header className="queue-head">
      <div>
        <h2 id="queue-heading">Queue</h2>
        {max_active !== null && <p className="meta">{describe(max_active)} Drag to reorder.</p>}
      </div>
      <ParallelControl on_change={on_change} />
    </header>
    {failure && <p role="alert" className="transfer-error">{failure}</p>}
    <ol className="queue-list" ref={list}>
      {order.map((transfer, index) => <QueueRow key={transfer.id} transfer={transfer} index={index} last={order.length - 1}
        dragging={drag !== null && line[drag.from]?.id === transfer.id} handle={handle(line.indexOf(transfer))}
        on_move={to => move(line.indexOf(transfer), to)} />)}
    </ol>
  </section>;
}
