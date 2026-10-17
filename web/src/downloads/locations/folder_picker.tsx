import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowRight, X } from 'lucide-react';
import { bytes } from '../../torrents/format';
import { FolderRows } from './folder_rows';
import { use_folders } from './use_folders';

type Props = { title: string; confirm: string; start: string | null; on_pick: (path: string) => void; on_close: () => void };

export function FolderPicker({ title, confirm, start, on_pick, on_close }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [path, set_path] = useState<string | null>(start || null);
  const [typed, set_typed] = useState(start ?? '');
  const { listing, error, loading } = use_folders(path);
  const shown = listing?.path ?? null;

  useEffect(() => { dialog.current?.showModal(); }, []);
  useEffect(() => { if (listing) set_typed(listing.path ?? ''); }, [listing]);

  function go(event: FormEvent) {
    event.preventDefault();
    set_path(typed.trim() || null);
  }

  return <dialog ref={dialog} className="folder-dialog" aria-labelledby="folder-title" onClose={on_close}>
    <header className="folder-head">
      <h2 id="folder-title">{title}</h2>
      <button type="button" className="icon-button small ghost" aria-label="Close" onClick={() => dialog.current?.close()}><X /></button>
    </header>
    <form className="folder-path" onSubmit={go}>
      <input value={typed} aria-label="Folder path" placeholder="Drives" spellCheck={false} autoCapitalize="off" autoCorrect="off"
        onChange={event => set_typed(event.target.value)} />
      <button type="submit" className="icon-button small" aria-label="Open this path" title="Open"><ArrowRight /></button>
    </form>
    <div className="folder-body" aria-busy={loading}>
      {error && <p className="folder-error" role="alert">{error}</p>}
      {listing && <FolderRows listing={listing} on_open={set_path} />}
      {!listing && !error && <p className="folder-empty">Loading folders…</p>}
    </div>
    <footer className="folder-foot">
      <p className="meta">{shown === null ? 'Pick a drive, then a folder.' : listing?.free_bytes != null ? `${bytes(listing.free_bytes)} free` : ''}</p>
      <div className="folder-actions">
        <button type="button" className="button secondary" onClick={() => dialog.current?.close()}>Cancel</button>
        <button type="button" className="button primary" disabled={shown === null || Boolean(error)}
          onClick={() => { if (shown !== null) { on_pick(shown); dialog.current?.close(); } }}>{confirm}</button>
      </div>
    </footer>
  </dialog>;
}
