export type CacheSettings = {
  metadata_hours: number;
  images_days: number;
  max_stale_days: number;
  image_limit_mb: number;
};

export type CacheStatus = {
  settings: CacheSettings;
  image_bytes: number;
  image_count: number;
  metadata_count: number;
};
