import { use_resource } from '../catalog/api';
import { bytes, speed } from '../torrents/format';
import type { Disk, TorrentSettings, Transfer } from '../torrents/types';

function drive(root: string) {
  return root.replace(/[\\/]+$/, '') || root;
}

export function StatusLine({ transfers, disks }: { transfers: Transfer[]; disks: Disk[] }) {
  const { resource } = use_resource<TorrentSettings>('/api/torrents/settings');
  const total = transfers.reduce((sum, transfer) => sum + transfer.download_bps, 0);
  return <p className="downloads-status">
    <span>{speed(total)}</span>
    {disks.map(disk => <span key={disk.root}>{bytes(disk.free_bytes)} free on {drive(disk.root)}</span>)}
    {resource.status === 'ready' && <span className="downloads-at-once">{resource.data.max_active} at once</span>}
  </p>;
}
