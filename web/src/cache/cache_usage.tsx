import type { CacheStatus } from './types';

export function CacheUsage({ status }: { status: CacheStatus }) {
  const items = [
    { label: 'Poster storage', value: `${(status.image_bytes / 1024 / 1024).toFixed(1)} MiB` },
    { label: 'Saved posters', value: status.image_count.toLocaleString() },
    { label: 'Title records', value: status.metadata_count.toLocaleString() },
  ];
  return <dl className="cache-usage">
    {items.map(item => <div key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}
  </dl>;
}
