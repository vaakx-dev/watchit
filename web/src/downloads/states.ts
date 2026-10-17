import type { Transfer, TransferState } from '../torrents/types';

export const FILTERS = ['all', 'downloading', 'seeding', 'completed', 'paused', 'error'] as const;
export type Filter = typeof FILTERS[number];

export const FILTER_LABELS: Record<Filter, string> = {
  all: 'All',
  downloading: 'Downloading',
  seeding: 'Seeding',
  completed: 'Completed',
  paused: 'Paused',
  error: 'Errored',
};

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

export function matches(transfer: Transfer, filter: Filter) {
  if (filter === 'all') return true;
  if (filter === 'downloading') return transfer.state === 'metadata' || transfer.state === 'queued' || transfer.state === 'downloading';
  if (filter === 'completed') return transfer.progress >= 1;
  return transfer.state === filter;
}

export function finished(transfer: Transfer) {
  return transfer.state === 'seeding' || transfer.state === 'completed';
}
