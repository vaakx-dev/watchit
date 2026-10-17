import { useState } from 'react';
import { use_resource } from '../catalog/api';
import { CatalogStatus } from '../catalog/components/status';
import { RemoteSection } from '../remote/remote_section';
import { Page } from '../ui/page';
import { CacheForm } from './cache_form';
import { CacheUsage } from './cache_usage';
import type { CacheStatus } from './types';

function Advanced({ initial }: { initial: CacheStatus }) {
  const [status, set_status] = useState(initial);
  return <section className="settings-section" aria-labelledby="settings-advanced">
    <h2 id="settings-advanced">Advanced</h2>
    <CacheUsage status={status} />
    <details className="settings-details">
      <summary>Cache settings</summary>
      <CacheForm status={status} on_saved={set_status} />
    </details>
  </section>;
}

export function Settings() {
  const { resource, retry } = use_resource<CacheStatus>('/api/cache', { cache: false });
  return <Page title="Settings"><div className="settings">
    <section className="settings-section" aria-labelledby="settings-library">
      <h2 id="settings-library">Library</h2>
      <p>Ratings, watch status, saved titles and history are stored on this server for each profile. They never expire with the cache.</p>
    </section>
    <RemoteSection />
    {resource.status === 'ready' ? <Advanced initial={resource.data} /> : <CatalogStatus error={resource.status === 'error' ? resource.error : undefined} retry={retry} />}
  </div></Page>;
}
