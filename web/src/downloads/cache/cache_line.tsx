import { useState } from 'react';
import { bytes } from '../../torrents/format';
import type { Transfer } from '../../torrents/types';
import { CacheDialog } from './cache_dialog';
import './cache.css';

export function CacheLine({ cached }: { cached: Transfer[] }) {
  const [managing, set_managing] = useState(false);
  if (!cached.length) return null;
  const size = cached.reduce((total, transfer) => total + transfer.downloaded_bytes, 0);
  return <div className="cache-line">
    <span>Watch cache · <strong>{bytes(size)}</strong></span>
    <button type="button" className="downloads-link" aria-haspopup="dialog" onClick={() => set_managing(true)}>Manage</button>
    {managing && <CacheDialog cached={cached} on_close={() => set_managing(false)} />}
  </div>;
}
