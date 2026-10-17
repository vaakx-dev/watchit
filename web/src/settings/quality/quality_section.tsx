import { use_resource } from '../../catalog/api';
import { Loading, SectionFrame } from '../controls/section_frame';
import { use_saving } from '../controls/use_saving';
import { QUALITY_URL, type QualityPreferences } from './api';
import { QualityForm } from './quality_form';

export function QualitySection() {
  const { resource, retry } = use_resource<QualityPreferences>(QUALITY_URL, { cache: false });
  const { saving, track } = use_saving();
  return <SectionFrame title="Quality" intro="What Watchit picks when you press Play or Download, and the order of the source list. Saved for this profile." saving={saving}>
    {resource.status === 'ready' ? <QualityForm initial={resource.data} track={track} />
      : <Loading error={resource.status === 'error' ? resource.error : null} retry={retry} />}
  </SectionFrame>;
}
