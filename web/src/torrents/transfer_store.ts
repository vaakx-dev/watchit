import { useSyncExternalStore } from 'react';
import { list_transfers } from './api';
import { read_events } from './event_stream';
import type { Disk, ReadyEvent, SpeedStatus, Transfer } from './types';

export type TransferSnapshot = { transfers: Transfer[]; disks: Disk[]; speed: SpeedStatus | null; live: boolean; error: string | null };

const RECONNECT_MS = 3000;
const DISK_REFRESH_MS = 10000;

let snapshot: TransferSnapshot = { transfers: [], disks: [], speed: null, live: false, error: null };
const listeners = new Set<() => void>();
const ready_listeners = new Set<(event: ReadyEvent) => void>();
let stop: (() => void) | null = null;

function publish(next: Partial<TransferSnapshot>) {
  snapshot = { ...snapshot, ...next };
  for (const listener of listeners) listener();
}

function message(cause: unknown) {
  return cause instanceof Error ? cause.message : 'The server did not respond.';
}

export function upsert_transfer(transfer: Transfer) {
  const others = snapshot.transfers.filter(item => item.id !== transfer.id);
  publish({ transfers: [...others, transfer].sort((a, b) => b.added_at - a.added_at) });
}

export function update_speed(speed: SpeedStatus) {
  publish({ speed });
}

export function remove_transfer(id: string) {
  publish({ transfers: snapshot.transfers.filter(item => item.id !== id) });
}

function refresh(signal: AbortSignal) {
  return list_transfers(signal).then(list => {
    publish({ transfers: [...list.transfers].sort((a, b) => b.added_at - a.added_at), disks: list.disks, speed: list.speed, error: null });
  });
}

export function on_ready_event(listener: (event: ReadyEvent) => void) {
  ready_listeners.add(listener);
  return () => { ready_listeners.delete(listener); };
}

function on_event(name: string, data: string) {
  if (name === 'transfer') upsert_transfer(JSON.parse(data) as Transfer);
  if (name === 'ready') for (const listener of ready_listeners) listener(JSON.parse(data) as ReadyEvent);
  if (name === 'removed') remove_transfer((JSON.parse(data) as { id: string }).id);
  if (name === 'speed') update_speed(JSON.parse(data) as SpeedStatus);
}

function connect() {
  const controller = new AbortController();
  const { signal } = controller;
  let retry = 0;

  const open = () => {
    read_events('/api/transfers/events', () => {
      publish({ live: true });
      refresh(signal).catch(cause => { if (!signal.aborted) publish({ error: message(cause) }); });
    }, event => on_event(event.name, event.data), signal)
      .catch(cause => { if (!signal.aborted) publish({ error: message(cause) }); })
      .finally(() => {
        if (signal.aborted) return;
        publish({ live: false });
        retry = window.setTimeout(open, RECONNECT_MS);
      });
  };
  open();
  const disk = window.setInterval(() => { refresh(signal).catch(() => undefined); }, DISK_REFRESH_MS);

  return () => {
    controller.abort();
    window.clearTimeout(retry);
    window.clearInterval(disk);
    publish({ live: false });
  };
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  stop ??= connect();
  return () => {
    listeners.delete(listener);
    if (listeners.size || !stop) return;
    stop();
    stop = null;
  };
}

export function use_transfers() {
  return useSyncExternalStore(subscribe, () => snapshot);
}

export function transfers_for(transfers: readonly Transfer[], title_id: string) {
  return transfers.filter(transfer => transfer.title_id === title_id || transfer.files.some(file => file.title_id === title_id));
}
