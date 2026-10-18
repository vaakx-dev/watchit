import { duration_text } from '../../catalog/format';
import { bytes, percent, speed } from '../../torrents/format';
import type { Transfer } from '../../torrents/types';
import { readiness_text } from '../readiness/readiness_text';
import { present, type Part } from '../row/status_text';

function running(transfer: Transfer) {
  return transfer.state === 'downloading';
}

function time_left(transfer: Transfer) {
  return running(transfer) && transfer.eta_seconds !== null ? `${duration_text(transfer.eta_seconds)} left` : null;
}

function lead(transfer: Transfer, place: number | null): Part | null {
  if (transfer.state === 'error') return { text: transfer.error ?? 'This download failed.', tone: 'failed' };
  if (transfer.state === 'metadata') return 'Fetching details';
  if (transfer.state === 'paused') return 'Paused';
  if (transfer.state === 'queued') return place === 1 ? 'Waiting · next in line' : 'Waiting';
  if (transfer.readiness.state === 'ready') return { text: 'Ready to watch', tone: 'ready' };
  return transfer.readiness.state === 'waiting' ? readiness_text(transfer.readiness) : null;
}

export function narrow_parts(transfer: Transfer, place: number | null) {
  const first = lead(transfer, place);
  if (transfer.state === 'queued') return present([first, bytes(transfer.size_bytes)]);
  if (transfer.state === 'metadata' || transfer.state === 'error') return present([first]);
  return first ? [first, percent(transfer.progress)] : present([percent(transfer.progress), time_left(transfer)]);
}

export function wide_parts(transfer: Transfer, place: number | null, quality: string | null) {
  return present([lead(transfer, place) ?? 'Downloading', quality, transfer.size_bytes ? bytes(transfer.size_bytes) : null]);
}

export function meta_lines(transfer: Transfer) {
  if (transfer.state === 'queued') return ['Queued'];
  if (transfer.state === 'metadata' || transfer.state === 'error') return [];
  const progress = present([percent(transfer.progress), time_left(transfer)]).join(' · ');
  return running(transfer) ? [progress, speed(transfer.download_bps)] : [progress];
}
