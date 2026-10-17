import { useState } from 'react';
import { ArrowDownToLine, Pause, Trash2 } from 'lucide-react';
import { update_transfer } from '../torrents/api';
import type { Transfer } from '../torrents/types';
import { FolderButton } from './locations/folder_button';
import { finished } from './states';

export function TransferActions({ transfer, on_remove }: { transfer: Transfer; on_remove: () => void }) {
  const [pending, set_pending] = useState(false);
  const [error, set_error] = useState<string | null>(null);
  const paused = transfer.state === 'paused';

  function patch(change: { paused?: boolean; kind?: 'download'; download_dir?: string }) {
    set_pending(true);
    set_error(null);
    update_transfer(transfer.id, change)
      .catch((cause: unknown) => set_error(cause instanceof Error ? cause.message : 'The server did not respond.'))
      .finally(() => set_pending(false));
  }

  return <div className="transfer-actions">
    {error && <span className="transfer-error" role="alert">{error}</span>}
    {transfer.kind === 'stream' && <button type="button" className="button ghost small" disabled={pending} onClick={() => patch({ kind: 'download' })}>
      <ArrowDownToLine />Keep
    </button>}
    {!finished(transfer) && transfer.state !== 'error' && <button type="button" className="button ghost small" disabled={pending}
      aria-label={`${paused ? 'Resume' : 'Pause'} ${transfer.name}`} onClick={() => patch({ paused: !paused })}>
      {paused ? <ArrowDownToLine /> : <Pause />}{paused ? 'Resume' : 'Pause'}
    </button>}
    <FolderButton label={`Move ${transfer.name} to another folder`} confirm="Move here" start={transfer.download_dir}
      disabled={pending || transfer.state === 'moving'} on_pick={folder => patch({ download_dir: folder })} />
    <button type="button" className="icon-button small ghost" aria-label={`Remove ${transfer.name}`} title="Remove" onClick={on_remove}>
      <Trash2 />
    </button>
  </div>;
}
