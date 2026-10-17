import { LIMITS } from './policy';
import type { CacheSettings } from './types';

export type Field = {
  key: keyof CacheSettings;
  label: string;
  unit: string;
  hint: string;
  min: number;
  max: number;
};

const definitions = [
  { key: 'metadata_hours', label: 'Refresh title details every', unit: 'hours', hint: 'Titles older than this are updated in the background.' },
  { key: 'images_days', label: 'Refresh posters every', unit: 'days', hint: 'How often saved posters and backdrops are downloaded again.' },
  { key: 'max_stale_days', label: 'Keep old posters if refresh fails', unit: 'days', hint: 'Expired images stay visible this long when the source is down. 0 turns it off.' },
  { key: 'image_limit_mb', label: 'Poster storage limit', unit: 'MiB', hint: 'A lower limit applies from the next download.' },
] as const;

export const fields: Field[] = definitions.map(field => ({ ...field, min: LIMITS[field.key][0], max: LIMITS[field.key][1] }));

export function field_error(field: Field, text: string) {
  const value = Number(text);
  if (text.trim() === '' || !Number.isFinite(value)) return 'Enter a number.';
  if (value < field.min || value > field.max) return `Use a value from ${field.min} to ${field.max}.`;
  return '';
}
