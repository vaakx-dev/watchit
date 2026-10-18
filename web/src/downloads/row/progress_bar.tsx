import type { CSSProperties } from 'react';
import type { Transfer } from '../../torrents/types';

export function ProgressBar({ transfer }: { transfer: Transfer }) {
  return <div className="download-progress" data-state={transfer.state} role="progressbar" aria-label={`${transfer.name} progress`}
    aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.floor(transfer.progress * 100)}>
    <span style={{ '--progress': `${transfer.progress * 100}%` } as CSSProperties} />
  </div>;
}
