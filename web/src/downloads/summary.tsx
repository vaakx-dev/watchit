import { speed } from '../torrents/format';
import type { Disk, Transfer } from '../torrents/types';
import { DriveSpace } from './locations/drive_space';

export function Summary({ transfers, disks }: { transfers: Transfer[]; disks: Disk[] }) {
  const down = transfers.reduce((total, transfer) => total + transfer.download_bps, 0);
  const up = transfers.reduce((total, transfer) => total + transfer.upload_bps, 0);
  const items = [
    { label: 'Download speed', value: speed(down) },
    { label: 'Upload speed', value: speed(up) },
  ];
  return <dl className="downloads-summary">
    {items.map(item => <div key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}
    <DriveSpace disks={disks} />
  </dl>;
}
