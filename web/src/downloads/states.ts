import type { Transfer, TransferState } from '../torrents/types';

export const STATE_LABELS: Record<TransferState, string> = {
  metadata: 'Fetching details',
  queued: 'Queued',
  downloading: 'Downloading',
  paused: 'Paused',
  moving: 'Moving files',
  seeding: 'Seeding',
  completed: 'Completed',
  error: 'Error',
};

export function finished(transfer: Transfer) {
  return transfer.state === 'seeding' || transfer.state === 'completed' || (transfer.progress >= 1 && transfer.state !== 'error');
}

function waiting(transfer: Transfer) {
  return transfer.queue_position !== null && (transfer.state === 'queued' || transfer.state === 'paused');
}

export function sections(transfers: readonly Transfer[]) {
  const downloads = transfers.filter(transfer => transfer.kind === 'download');
  const unfinished = downloads.filter(transfer => !finished(transfer));
  return {
    now: unfinished.filter(transfer => !waiting(transfer)),
    up_next: unfinished.filter(waiting).sort((a, b) => (a.queue_position ?? 0) - (b.queue_position ?? 0)),
    completed: downloads.filter(finished),
    streams: transfers.filter(transfer => transfer.kind === 'stream'),
  };
}
