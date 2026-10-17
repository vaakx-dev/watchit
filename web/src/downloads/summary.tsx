import { bytes, speed } from '../torrents/format';
import type { Disk, Transfer } from '../torrents/types';

export function Summary({ transfers, disk }: { transfers: Transfer[]; disk: Disk | null }) {
  const down = transfers.reduce((total, transfer) => total + transfer.download_bps, 0);
  const up = transfers.reduce((total, transfer) => total + transfer.upload_bps, 0);
  const items = [
    { label: 'Download speed', value: speed(down) },
    { label: 'Upload speed', value: speed(up) },
    { label: 'Space used', value: disk ? bytes(disk.used_bytes) : '…', note: disk?.budget_bytes ? `of ${bytes(disk.budget_bytes)}` : null },
    { label: 'Free space', value: disk ? bytes(disk.free_bytes) : '…' },
  ];
  return <dl className="downloads-summary">
    {items.map(item => <div key={item.label}><dt>{item.label}</dt><dd>{item.value}{item.note && <small> {item.note}</small>}</dd></div>)}
  </dl>;
}
