import type { KeyboardEvent, PointerEvent } from 'react';
import { ChevronDown, ChevronsDown, ChevronsUp, ChevronUp, GripVertical } from 'lucide-react';
import { percent, speed } from '../../torrents/format';
import type { Transfer } from '../../torrents/types';
import { STATE_LABELS } from '../states';

type Handle = {
  onPointerDown: (event: PointerEvent<HTMLElement>) => void;
  onPointerMove: (event: PointerEvent<HTMLElement>) => void;
  onPointerUp: () => void;
  onPointerCancel: () => void;
};

function episode_label(title_id: string) {
  const [, season, episode] = title_id.split(':');
  return season && episode ? `S${season} E${episode}` : null;
}

export function QueueRow({ transfer, index, last, dragging, handle, on_move }: {
  transfer: Transfer;
  index: number;
  last: number;
  dragging: boolean;
  handle: Handle;
  on_move: (to: number) => void;
}) {
  const episode = episode_label(transfer.title_id);
  const keys: Record<string, number> = { ArrowUp: index - 1, ArrowDown: index + 1, Home: 0, End: last };

  function key(event: KeyboardEvent) {
    const to = keys[event.key];
    if (to === undefined || to < 0 || to > last || to === index) return;
    event.preventDefault();
    on_move(to);
  }

  return <li className="queue-row" data-queue-row data-dragging={dragging || undefined} data-state={transfer.state}>
    <button type="button" className="queue-handle" {...handle} onKeyDown={key}
      aria-label={`Reorder ${transfer.name}, position ${index + 1} of ${last + 1}`} title="Drag to reorder">
      <GripVertical />
    </button>
    <span className="queue-number">{index + 1}</span>
    <div className="queue-copy">
      <p className="queue-name">{episode && <strong>{episode}</strong>}<span>{transfer.name}</span></p>
      <p className="meta">
        <span>{STATE_LABELS[transfer.state]}</span>
        <span>{percent(transfer.progress)}</span>
        {transfer.state === 'downloading' && <span>{speed(transfer.download_bps)}</span>}
      </p>
    </div>
    <div className="queue-actions">
      {index > 0 && <button type="button" className="button ghost small" onClick={() => on_move(0)}><ChevronsUp />Download next</button>}
      <button type="button" className="icon-button small ghost" disabled={index === 0} onClick={() => on_move(index - 1)}
        aria-label={`Move ${transfer.name} up`} title="Move up"><ChevronUp /></button>
      <button type="button" className="icon-button small ghost" disabled={index === last} onClick={() => on_move(index + 1)}
        aria-label={`Move ${transfer.name} down`} title="Move down"><ChevronDown /></button>
      <button type="button" className="icon-button small ghost" disabled={index === last} onClick={() => on_move(last)}
        aria-label={`Move ${transfer.name} to bottom`} title="Move to bottom"><ChevronsDown /></button>
    </div>
  </li>;
}
