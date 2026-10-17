import type { CacheSettings } from './types.ts';

export const DEFAULTS = {
  metadata_hours: 24,
  images_days: 30,
  max_stale_days: 7,
  image_limit_mb: 1024,
} satisfies CacheSettings;

export const LIMITS = {
  metadata_hours: [0.25, 8760],
  images_days: [0.25, 365],
  max_stale_days: [0, 365],
  image_limit_mb: [16, 10240],
} as const satisfies Record<keyof CacheSettings, readonly [number, number]>;
