import { Bell, BellRing } from 'lucide-react';
import { useState } from 'react';
import { update_transfer } from '../../torrents/api';
import type { Transfer } from '../../torrents/types';
import { ask_notify_permission, permission_problem } from './permission';

export function NotifyButton({ transfer }: { transfer: Transfer }) {
  const [pending, set_pending] = useState(false);
  const [problem, set_problem] = useState<string | null>(null);
  const on = transfer.notify_when_ready;
  const label = on ? 'Stop telling me when this is ready to watch' : 'Tell me when this is ready to watch';

  async function toggle() {
    set_pending(true);
    set_problem(null);
    try {
      if (!on) {
        const permission = await ask_notify_permission();
        const blocked = permission_problem(permission);
        if (blocked || permission !== 'granted') {
          set_problem(blocked ?? 'Allow notifications to be told when this is ready.');
          return;
        }
      }
      await update_transfer(transfer.id, { notify_when_ready: !on });
    } catch (cause) {
      set_problem(cause instanceof Error ? cause.message : 'The server did not respond.');
    } finally {
      set_pending(false);
    }
  }

  return <>
    {problem && <span className="transfer-error" role="alert">{problem}</span>}
    <button type="button" className="icon-button small ghost" aria-pressed={on} aria-label={label} title={label} disabled={pending}
      onClick={() => { void toggle(); }}>
      {on ? <BellRing /> : <Bell />}
    </button>
  </>;
}
