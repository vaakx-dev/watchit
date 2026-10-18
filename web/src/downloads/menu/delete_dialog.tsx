import { useEffect, useRef, useState } from 'react';
import { error_message } from '../../catalog/client';
import { delete_transfer } from '../../torrents/api';
import { remove_transfer } from '../../torrents/transfer_store';
import type { Transfer } from '../../torrents/types';

export type Deletion = { heading: string; body: string; transfers: Transfer[] };

export async function delete_downloads(transfers: readonly Transfer[]) {
  for (const transfer of transfers) {
    await delete_transfer(transfer.id, true);
    remove_transfer(transfer.id);
  }
}

export function DeleteDialog({ deletion, on_close }: { deletion: Deletion; on_close: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [pending, set_pending] = useState(false);
  const [error, set_error] = useState<string | null>(null);

  useEffect(() => { dialog.current?.showModal(); }, []);

  async function remove() {
    set_pending(true);
    set_error(null);
    try {
      await delete_downloads(deletion.transfers);
      dialog.current?.close();
    } catch (cause) {
      set_error(error_message(cause));
      set_pending(false);
    }
  }

  return <dialog ref={dialog} className="delete-dialog" aria-labelledby="delete-title" aria-describedby="delete-body" onClose={on_close}>
    <h2 id="delete-title">{deletion.heading}</h2>
    <p id="delete-body">{deletion.body}</p>
    {error && <p className="delete-error" role="alert">{error}</p>}
    <div className="delete-actions">
      <button type="button" className="button secondary" autoFocus onClick={() => dialog.current?.close()}>Cancel</button>
      <button type="button" className="button danger" disabled={pending} onClick={() => { void remove(); }}>
        {pending ? 'Deleting…' : 'Delete'}
      </button>
    </div>
  </dialog>;
}
