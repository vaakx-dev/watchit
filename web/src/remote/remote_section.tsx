import { useState } from 'react';
import { use_resource } from '../catalog/api';
import { CatalogStatus } from '../catalog/components/status';
import { AddressList } from './address_list';
import { InstallPanel } from './install_panel';
import { TailscalePanel } from './tailscale_panel';
import type { RemoteStatus } from './types';

export function RemoteSection() {
  const { resource, retry } = use_resource<RemoteStatus>('/api/remote', { cache: false });
  const [changed, set_changed] = useState<RemoteStatus | null>(null);
  const status = changed ?? (resource.status === 'ready' ? resource.data : null);

  function recheck() {
    set_changed(null);
    retry();
  }

  return <section className="settings-section remote" aria-labelledby="settings-remote">
    <h2 id="settings-remote">Connect another device</h2>
    {status ? <>
      <p>Open Watchit from a phone, tablet or another PC. Each profile signs in on that device the same way.</p>
      {status.addresses.length > 0 ? <>
        <AddressList addresses={status.addresses} />
        <p className="remote-hint">Devices on the same network can open the plain addresses. If a device cannot connect, allow Watchit through the Windows firewall for private networks.</p>
      </> : <p className="remote-hint">{status.network ? 'No network address was found. Connect this PC to a network and check again.' : 'This server only accepts connections from this PC.'}</p>}
      <TailscalePanel status={status} on_changed={set_changed} on_recheck={recheck} />
      <InstallPanel />
    </> : <CatalogStatus error={resource.status === 'error' ? resource.error : undefined} retry={retry} message="Looking for network addresses." />}
  </section>;
}
