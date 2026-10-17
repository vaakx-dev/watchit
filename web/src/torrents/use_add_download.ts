import { useState } from 'react';
import { add_transfer } from './api';
import { upsert_transfer } from './transfer_store';
import type { Transfer } from './types';

export function use_add_download<T extends unknown[]>(start: (...args: T) => Promise<Transfer | Transfer[]>) {
  const [pending, set_pending] = useState(false);
  const [error, set_error] = useState<string | null>(null);

  async function run(...args: T) {
    set_pending(true);
    set_error(null);
    try {
      const added = await start(...args);
      for (const transfer of Array.isArray(added) ? added : [added]) upsert_transfer(transfer);
    } catch (cause) {
      set_error(cause instanceof Error ? cause.message : 'The server did not respond.');
    } finally {
      set_pending(false);
    }
  }

  return { pending, error, run };
}

export function download_file(info_hash: string, file_index: number | null, title_id: string, notify_when_ready = false) {
  return add_transfer(info_hash, file_index === null ? null : [file_index], title_id, 'download', notify_when_ready);
}
