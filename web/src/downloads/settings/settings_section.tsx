import { use_resource } from '../../catalog/api';
import { CatalogStatus } from '../../catalog/components/status';
import type { TorrentSettings } from '../../torrents/types';
import { SettingsForm } from './settings_form';

export function SettingsSection() {
  const { resource, retry } = use_resource<TorrentSettings>('/api/torrents/settings', { cache: false });
  return <section className="settings-section downloads-settings" aria-labelledby="torrent-settings">
    <details className="settings-details">
      <summary id="torrent-settings">Torrent settings</summary>
      {resource.status === 'ready' ? <SettingsForm initial={resource.data} />
        : <CatalogStatus message="Loading settings." error={resource.status === 'error' ? resource.error : undefined} retry={retry} />}
    </details>
  </section>;
}
