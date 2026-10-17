import { useEffect, useRef, useState } from 'react';
import { delete_transfer } from '../torrents/api';
import { remove_transfer } from '../torrents/transfer_store';
import type { Transfer } from '../torrents/types';

export function RemoveDialog({ transfer, on_close }: { transfer: Transfer; on_close: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [delete_files, set_delete_files] = useState(false);
  const [pending, set_pending] = useState(false);
  const [error, set_error] = useState<string | null>(null);

  useEffect(() => { dialog.current?.showModal(); }, []);

  async function remove() {
    set_pending(true);
    set_error(null);
    try {
      await delete_transfer(transfer.id, delete_files);
      remove_transfer(transfer.id);
      on_close();
    } catch (cause) {
      set_error(cause instanceof Error ? cause.message : 'The server did not respond.');
      set_pending(false);
    }
  }

  return <dialog ref={dialog} className="remove-dialog" aria-labelledby="remove-title" onClose={on_close}>
    <h2 id="remove-title">Remove “{transfer.name}” from downloads?</h2>
    <label className="remove-files">
      <input type="checkbox" checked={delete_files} onChange={event => set_delete_files(event.target.checked)} />
      Also delete the downloaded files
    </label>
    {error && <p className="remove-error" role="alert">{error}</p>}
    <div className="remove-actions">
      <button type="button" className="button secondary" autoFocus onClick={() => dialog.current?.close()}>Cancel</button>
      <button type="button" className="button primary" disabled={pending} onClick={() => { void remove(); }}>
        {delete_files ? 'Remove and delete files' : 'Remove'}
      </button>
    </div>
  </dialog>;
}
