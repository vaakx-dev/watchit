import type { KeyboardEvent, PointerEvent } from 'react';
import { ChevronDown, ChevronsUp, ChevronUp, GripVertical, Trash2 } from 'lucide-react';
import { Artwork } from '../../catalog/components/artwork';
import { bytes, percent } from '../../torrents/format';
import type { Transfer } from '../../torrents/types';
import { STATE_LABELS } from '../states';
import { use_transfer_title } from '../titles';

type Handle = {
  onPointerDown: (event: PointerEvent<HTMLElement>) => void;
  onPointerMove: (event: PointerEvent<HTMLElement>) => void;
  onPointerUp: () => void;
  onPointerCancel: () => void;
};

export function QueueRow({ transfer, index, last, dragging, handle, on_move, on_remove }: {
  transfer: Transfer;
  index: number;
  last: number;
  dragging: boolean;
  handle: Handle;
  on_move: (to: number) => void;
  on_remove: () => void;
}) {
  const { title, name, episode } = use_transfer_title(transfer);
  const keys: Record<string, number> = { ArrowUp: index - 1, ArrowDown: index + 1, Home: 0, End: last };

  function key(event: KeyboardEvent) {
    const to = keys[event.key];
    if (to === undefined || to < 0 || to > last || to === index) return;
    event.preventDefault();
    on_move(to);
  }

  return <li className="queue-row" data-queue-row data-dragging={dragging || undefined} data-state={transfer.state}>
    <button type="button" className="queue-handle" {...handle} onKeyDown={key}
      aria-label={`Reorder ${name}, position ${index + 1} of ${last + 1}`} title="Drag to reorder">
      <GripVertical />
    </button>
    <span className="queue-number">{index + 1}</span>
    <div className="queue-poster"><Artwork src={title?.artwork ?? ''} /></div>
    <div className="queue-copy">
      <p className="queue-name">{episode && <strong>{episode}</strong>}<span>{name}</span></p>
      <p className="meta">
        <span>{STATE_LABELS[transfer.state]}</span>
        <span>{transfer.progress > 0 ? `${percent(transfer.progress)} of ${bytes(transfer.size_bytes)}` : bytes(transfer.size_bytes)}</span>
      </p>
    </div>
    <div className="queue-actions">
      {index > 0 && <button type="button" className="button ghost small queue-next" onClick={() => on_move(0)}
        aria-label={`Download ${name} next`} title="Download next"><ChevronsUp /><span>Download next</span></button>}
      <button type="button" className="icon-button small ghost" disabled={index === 0} onClick={() => on_move(index - 1)}
        aria-label={`Move ${name} up`} title="Move up"><ChevronUp /></button>
      <button type="button" className="icon-button small ghost" disabled={index === last} onClick={() => on_move(index + 1)}
        aria-label={`Move ${name} down`} title="Move down"><ChevronDown /></button>
      <button type="button" className="icon-button small ghost" onClick={on_remove} aria-label={`Remove ${transfer.name}`} title="Remove"><Trash2 /></button>
    </div>
  </li>;
}
