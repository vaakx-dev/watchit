import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { update_transfer } from '../../torrents/api';
import type { Transfer } from '../../torrents/types';
import { delete_downloads } from '../menu/delete_dialog';
import { CachedRow } from './cached_row';

export function CacheDialog({ cached, on_close }: { cached: Transfer[]; on_close: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [pending, set_pending] = useState(false);
  const [error, set_error] = useState<string | null>(null);

  useEffect(() => { dialog.current?.showModal(); }, []);
  useEffect(() => { if (!cached.length) dialog.current?.close(); }, [cached.length]);

  function run(work: () => Promise<unknown>) {
    set_pending(true);
    set_error(null);
    work()
      .catch((cause: unknown) => set_error(cause instanceof Error ? cause.message : 'The server did not respond.'))
      .finally(() => set_pending(false));
  }

  return <dialog ref={dialog} className="cache-dialog" aria-labelledby="cache-title" onClose={on_close}>
    <header className="cache-head">
      <div>
        <h2 id="cache-title">Watch cache</h2>
        <p>Titles you streamed stay here so they start fast next time.</p>
      </div>
      <button type="button" className="icon-button small ghost" aria-label="Close" onClick={() => dialog.current?.close()}><X /></button>
    </header>
    <ul className="cached-list">
      {cached.map(transfer => <CachedRow key={transfer.id} transfer={transfer} disabled={pending}
        on_keep={() => run(() => update_transfer(transfer.id, { kind: 'download' }))}
        on_delete={() => run(() => delete_downloads([transfer]))} />)}
    </ul>
    {error && <p className="delete-error" role="alert">{error}</p>}
    <footer className="cache-foot">
      <button type="button" className="button secondary" disabled={pending} onClick={() => run(() => delete_downloads(cached))}>Clear cache</button>
    </footer>
  </dialog>;
}
