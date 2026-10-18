import type { CacheSettings } from './types';

export const LIMITS = {
  metadata_hours: [0.25, 8760],
  images_days: [0.25, 365],
  max_stale_days: [0, 365],
  image_limit_mb: [16, 10240],
} as const satisfies Record<keyof CacheSettings, readonly [number, number]>;
