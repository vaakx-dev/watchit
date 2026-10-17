import { use_resource } from '../catalog/api';
import { Artwork } from '../catalog/components/artwork';
import type { TitleResult } from '../catalog/types';
import { bytes } from '../torrents/format';
import type { Transfer } from '../torrents/types';
import { TransferRow } from './transfer_row';

export function group_id(transfer: Transfer) {
  return transfer.title_id.split(':')[0] ?? transfer.title_id;
}

export function TransferGroup({ id, transfers, on_remove }: { id: string; transfers: Transfer[]; on_remove: (transfer: Transfer) => void }) {
  const { resource } = use_resource<TitleResult>(`/api/titles/${encodeURIComponent(id)}`);
  const title = resource.status === 'ready' ? resource.data.title : null;
  const size = transfers.reduce((total, transfer) => total + transfer.size_bytes, 0);
  const count = transfers.length;

  return <section className="transfer-group" aria-label={title?.title ?? id}>
    <a className="transfer-group-head" href={`#/title/${id}`}>
      <div className="transfer-poster"><Artwork src={title?.artwork ?? ''} /></div>
      <div>
        <h2>{title?.title ?? transfers[0]?.name ?? id}</h2>
        <p className="meta"><span>{count === 1 ? '1 download' : `${count} downloads`}</span><span>{bytes(size)}</span></p>
      </div>
    </a>
    <ol className="transfer-list">
      {[...transfers].sort((a, b) => a.title_id.localeCompare(b.title_id, undefined, { numeric: true }))
        .map(transfer => <TransferRow key={transfer.id} transfer={transfer} on_remove={() => on_remove(transfer)} />)}
    </ol>
  </section>;
}
