import { update_transfer } from '../../torrents/api';
import type { Transfer } from '../../torrents/types';
import { ask_notify_permission, permission_problem } from './permission';

export async function toggle_notify(transfer: Transfer) {
  if (!transfer.notify_when_ready) {
    const permission = await ask_notify_permission();
    if (permission !== 'granted') throw new Error(permission_problem(permission) ?? 'Allow notifications to be told when this is ready.');
  }
  await update_transfer(transfer.id, { notify_when_ready: !transfer.notify_when_ready });
}
