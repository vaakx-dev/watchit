import { ArrowDown, ArrowUp, HardDrive, Settings } from 'lucide-react';
import { bytes, speed as rate } from '../torrents/format';
import type { Disk, SpeedStatus, Transfer } from '../torrents/types';
import { SpeedMode } from './bandwidth/speed_mode';

function DiskSpace({ disk }: { disk: Disk }) {
  const used = disk.budget_bytes ? `${bytes(disk.used_bytes)} of ${bytes(disk.budget_bytes)} used` : `${bytes(disk.used_bytes)} used`;
  return <span title={used}><HardDrive />{bytes(disk.free_bytes)} free on {disk.root}</span>;
}

export function StatusLine({ transfers, disks, speed }: { transfers: Transfer[]; disks: Disk[]; speed: SpeedStatus | null }) {
  const down = transfers.reduce((total, transfer) => total + transfer.download_bps, 0);
  const up = transfers.reduce((total, transfer) => total + transfer.upload_bps, 0);
  return <div className="downloads-status">
    <p className="downloads-status-items">
      <span aria-label={`Downloading at ${rate(down)}`}><ArrowDown />{rate(down)}</span>
      <span aria-label={`Uploading at ${rate(up)}`}><ArrowUp />{rate(up)}</span>
      {speed && <SpeedMode speed={speed} />}
      {disks.map(disk => <DiskSpace key={disk.root} disk={disk} />)}
    </p>
    <a className="button ghost small" href="#/settings"><Settings />Download settings</a>
  </div>;
}
