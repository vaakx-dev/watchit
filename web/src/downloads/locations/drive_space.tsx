import { bytes } from '../../torrents/format';
import type { Disk } from '../../torrents/types';

export function DriveSpace({ disks }: { disks: Disk[] }) {
  if (disks.length === 0) return <>
    <div><dt>Space used</dt><dd>…</dd></div>
    <div><dt>Free space</dt><dd>…</dd></div>
  </>;
  const [disk] = disks;
  if (disks.length === 1 && disk) {
    return <>
      <div><dt>Space used</dt><dd>{bytes(disk.used_bytes)}{disk.budget_bytes && <small> of {bytes(disk.budget_bytes)}</small>}</dd></div>
      <div><dt>Free space</dt><dd>{bytes(disk.free_bytes)}</dd></div>
    </>;
  }
  return <>{disks.map(disk => <div key={disk.root}>
    <dt>Free on {disk.root}</dt>
    <dd>{bytes(disk.free_bytes)}<small> {bytes(disk.used_bytes)} used{disk.budget_bytes ? ` of ${bytes(disk.budget_bytes)}` : ''}</small></dd>
  </div>)}</>;
}
