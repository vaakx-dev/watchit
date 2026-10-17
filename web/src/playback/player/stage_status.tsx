import { percent, speed } from '../../torrents/format';
import type { Transfer } from '../../torrents/types';

function TransferLine({ transfer }: { transfer: Transfer }) {
  if (transfer.state === 'metadata') return <p className="meta">Fetching torrent details · {transfer.peers} {transfer.peers === 1 ? 'peer' : 'peers'}</p>;
  if (transfer.state === 'completed' || transfer.state === 'seeding') return null;
  return <p className="meta">
    <span>{transfer.peers} {transfer.peers === 1 ? 'peer' : 'peers'}</span>
    <span>{speed(transfer.download_bps)}</span>
    <span>{percent(transfer.progress)}</span>
  </p>;
}

export function StageStatus({ message, error, transfer, on_sources }: { message: string | null; error: string | null; transfer: Transfer | null; on_sources: () => void }) {
  if (error) return <div className="stage-status" role="alert">
    <p>{error}</p>
    <button type="button" className="button secondary small" onClick={on_sources}>Try another source</button>
  </div>;
  if (!message) return null;
  return <div className="stage-status" role="status">
    <span className="spinner" aria-hidden="true" />
    <p>{message}</p>
    {transfer && <TransferLine transfer={transfer} />}
  </div>;
}
