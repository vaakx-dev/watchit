import { Bell, BellOff, ChevronsUp, Pause, Play } from 'lucide-react';
import { update_transfer } from '../../torrents/api';
import type { Transfer } from '../../torrents/types';
import { toggle_notify } from '../notify/toggle_notify';
import { move_to } from '../queue/queue_order';
import type { MenuAction } from './action_menu';

export function resumable(transfer: Transfer) {
  return transfer.state === 'paused' || transfer.state === 'error';
}

export function toggle_pause(transfer: Transfer) {
  return update_transfer(transfer.id, { paused: !resumable(transfer) });
}

export function control_actions(transfer: Transfer, run: (work: () => Promise<unknown>) => void): MenuAction[] {
  const resume = resumable(transfer);
  const actions: MenuAction[] = [{ label: resume ? 'Resume' : 'Pause', icon: resume ? Play : Pause, run: () => run(() => toggle_pause(transfer)) }];
  if (transfer.queue_position !== 0) actions.push({ label: 'Download next', icon: ChevronsUp, run: () => run(() => move_to(transfer, 0)) });
  if (transfer.readiness.state !== 'ready') actions.push(transfer.notify_when_ready
    ? { label: 'Don’t notify me', icon: BellOff, run: () => run(() => toggle_notify(transfer)) }
    : { label: 'Notify me when it’s ready', icon: Bell, run: () => run(() => toggle_notify(transfer)) });
  return actions;
}
