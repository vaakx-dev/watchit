import { update_transfer } from '../../torrents/api';
import type { Transfer } from '../../torrents/types';

export function queued(transfers: readonly Transfer[]) {
  return transfers.filter(transfer => transfer.queue_position !== null)
    .sort((a, b) => (a.queue_position ?? 0) - (b.queue_position ?? 0));
}

export function moved<T>(list: readonly T[], from: number, to: number) {
  const next = [...list];
  const [item] = next.splice(from, 1);
  if (item !== undefined) next.splice(to, 0, item);
  return next;
}

export function move_to(transfer: Transfer, position: number) {
  const resume = transfer.state === 'paused' && position === 0 ? { paused: false } : {};
  return update_transfer(transfer.id, { ...resume, queue_position: Math.max(0, position) });
}
