import type { Transfer } from '../torrents/types';

function finished(transfer: Transfer) {
  return transfer.state === 'seeding' || transfer.state === 'completed' || (transfer.progress >= 1 && transfer.state !== 'error');
}

function queue_order(a: Transfer, b: Transfer) {
  return (a.queue_position ?? Number.MAX_SAFE_INTEGER) - (b.queue_position ?? Number.MAX_SAFE_INTEGER) || a.added_at - b.added_at;
}

export function sections(transfers: readonly Transfer[]) {
  const downloads = transfers.filter(transfer => transfer.kind === 'download');
  return {
    downloading: downloads.filter(transfer => !finished(transfer)).sort(queue_order),
    downloaded: downloads.filter(finished),
    cached: transfers.filter(transfer => transfer.kind === 'stream'),
  };
}
