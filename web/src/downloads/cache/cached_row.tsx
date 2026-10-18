import { ArrowDownToLine, Trash2 } from 'lucide-react';
import { Artwork } from '../../catalog/components/artwork';
import { bytes } from '../../torrents/format';
import type { Transfer } from '../../torrents/types';
import { use_transfer_title } from '../titles';

export function CachedRow({ transfer, disabled, on_keep, on_delete }: {
  transfer: Transfer;
  disabled: boolean;
  on_keep: () => void;
  on_delete: () => void;
}) {
  const { title, name, episode } = use_transfer_title(transfer);
  const label = episode ? `${name} ${episode}` : name;
  return <li className="cached-row">
    <span className="download-poster"><Artwork src={title?.artwork ?? ''} label={name} /></span>
    <span className="cached-copy">
      <strong>{label}</strong>
      <span>{bytes(transfer.downloaded_bytes)}</span>
    </span>
    <button type="button" className="button secondary small" disabled={disabled} onClick={on_keep}><ArrowDownToLine />Download</button>
    <button type="button" className="icon-button small ghost" disabled={disabled} aria-label={`Delete ${label} from the cache`} title="Delete"
      onClick={on_delete}><Trash2 /></button>
  </li>;
}
