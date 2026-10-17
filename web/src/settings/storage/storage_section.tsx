import { useEffect, useState } from 'react';
import { LIMITS } from '../../cache/policy';
import type { CacheSettings, CacheStatus } from '../../cache/types';
import { request, send } from '../../catalog/client';
import { bytes } from '../../torrents/format';
import { NumberInput, type NumberSpec } from '../controls/number_input';
import { Loading, SectionFrame } from '../controls/section_frame';
import { SettingGroup } from '../controls/setting_group';
import { use_saving } from '../controls/use_saving';

type Spec = NumberSpec & { key: keyof CacheSettings };

const spec = (key: keyof CacheSettings, label: string, hint: string, unit: string): Spec =>
  ({ key, id: key, label, hint, unit, min: LIMITS[key][0], max: LIMITS[key][1] });

const FIELDS: Spec[] = [
  spec('metadata_hours', 'Refresh title details every', 'Older details update in the background.', 'hours'),
  spec('images_days', 'Refresh posters every', 'Saved posters and backdrops download again after this.', 'days'),
  spec('max_stale_days', 'Keep old posters for', 'Shown while the source is down. 0 turns this off.', 'days'),
  spec('image_limit_mb', 'Poster storage limit', 'Applies from the next download.', 'MB'),
];

function Usage({ status }: { status: CacheStatus }) {
  const items = [
    { label: 'Posters', value: bytes(status.image_bytes) },
    { label: 'Saved posters', value: status.image_count.toLocaleString() },
    { label: 'Title records', value: status.metadata_count.toLocaleString() },
  ];
  return <dl className="setting-usage">
    {items.map(item => <div key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}
  </dl>;
}

export function StorageSection() {
  const [status, set_status] = useState<CacheStatus | null>(null);
  const [error, set_error] = useState<string | null>(null);
  const [attempt, set_attempt] = useState(0);
  const { saving, track } = use_saving();

  useEffect(() => {
    const controller = new AbortController();
    request<CacheStatus>('/api/cache', { signal: controller.signal }).then(set_status)
      .catch((cause: unknown) => { if (!controller.signal.aborted) set_error(cause instanceof Error ? cause.message : 'The server did not respond.'); });
    return () => controller.abort();
  }, [attempt]);

  function save(key: keyof CacheSettings, value: number) {
    if (!status) return;
    track(send<CacheStatus>('/api/cache', 'PATCH', { ...status.settings, [key]: value })).then(set_status).catch(() => undefined);
  }

  return <SectionFrame title="Storage" intro="Watchit keeps title details and posters on this server so pages open fast. Your library is never cleared." saving={saving}>
    {status ? <>
      <Usage status={status} />
      <SettingGroup title="Cache">
        {FIELDS.map(field => <NumberInput key={field.key} spec={field} value={status.settings[field.key]}
          on_save={value => { if (value !== null) save(field.key, value); }} />)}
      </SettingGroup>
    </> : <Loading error={error} retry={() => { set_error(null); set_attempt(value => value + 1); }} />}
  </SectionFrame>;
}
