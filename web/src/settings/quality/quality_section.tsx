import { use_resource } from '../../catalog/api';
import { CatalogStatus } from '../../catalog/components/status';
import { QUALITY_URL, type QualityPreferences } from './api';
import { QualityForm } from './quality_form';

export function QualitySection() {
  const { resource, retry } = use_resource<QualityPreferences>(QUALITY_URL, { cache: false });
  return <section className="settings-section" aria-labelledby="settings-quality">
    <h2 id="settings-quality">Quality</h2>
    <p>What Watchit picks when you press Play or Download. It is saved for this profile and changes the order of the source list.</p>
    {resource.status === 'ready' ? <QualityForm initial={resource.data} />
      : <CatalogStatus message="Loading quality settings." error={resource.status === 'error' ? resource.error : undefined} retry={retry} />}
  </section>;
}
