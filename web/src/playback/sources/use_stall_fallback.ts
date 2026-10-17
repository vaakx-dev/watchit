import { useEffect } from 'react';
import type { Transfer } from '../../torrents/types';

const STALL_SECONDS = 30;

function stuck(transfer: Transfer | null) {
  if (!transfer) return true;
  return transfer.state === 'metadata' || (transfer.peers === 0 && transfer.downloaded_bytes === 0);
}

export function use_stall_fallback(active: boolean, transfer: Transfer | null, on_stall: () => void) {
  const stalled = active && stuck(transfer);

  useEffect(() => {
    if (!stalled) return;
    const timer = window.setTimeout(on_stall, STALL_SECONDS * 1000);
    return () => window.clearTimeout(timer);
  }, [stalled]);
}
