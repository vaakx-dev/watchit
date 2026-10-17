import type { TorrentSettings } from '../../torrents/types';

export const FOLDER_KEYS = ['download_dir', 'movie_dir', 'series_dir'] as const;

type NumberKey = Exclude<keyof TorrentSettings, typeof FOLDER_KEYS[number]>;

export type NumberField = { key: NumberKey; label: string; unit: string; hint: string; scale: number; optional: boolean; integer: boolean };

const GIB = 1024 ** 3;
const MIB = 1024 ** 2;

export const NUMBER_FIELDS: NumberField[] = [
  { key: 'disk_budget_bytes', label: 'Space for downloads', unit: 'GiB', hint: 'The most Watchit keeps on each drive. Leave empty to use any free space.', scale: GIB, optional: true, integer: false },
  { key: 'max_download_bps', label: 'Download speed limit', unit: 'MiB/s', hint: 'Leave empty for no limit.', scale: MIB, optional: true, integer: false },
  { key: 'max_upload_bps', label: 'Upload speed limit', unit: 'MiB/s', hint: 'Leave empty for no limit.', scale: MIB, optional: true, integer: false },
  { key: 'seed_ratio', label: 'Stop seeding at ratio', unit: '×', hint: 'Uploaded divided by downloaded. Leave empty to keep seeding.', scale: 1, optional: true, integer: false },
  { key: 'seed_minutes', label: 'Stop seeding after', unit: 'min', hint: 'Leave empty to keep seeding.', scale: 1, optional: true, integer: true },
  { key: 'max_active', label: 'Active downloads at once', unit: '', hint: 'Others wait in the queue.', scale: 1, optional: false, integer: true },
];

export type Values = Record<keyof TorrentSettings, string>;

function shown(value: number | null, scale: number) {
  if (value === null) return '';
  return String(Number((value / scale).toFixed(2)));
}

export function to_values(settings: TorrentSettings): Values {
  const numbers = Object.fromEntries(NUMBER_FIELDS.map(field => [field.key, shown(settings[field.key], field.scale)]));
  return { ...numbers, download_dir: settings.download_dir, movie_dir: settings.movie_dir ?? '', series_dir: settings.series_dir ?? '' } as Values;
}

export function field_error(field: NumberField, text: string) {
  if (text.trim() === '') return field.optional ? '' : 'Enter a number.';
  const value = Number(text);
  if (!Number.isFinite(value) || value < 0) return 'Enter a positive number.';
  if (field.integer && !Number.isInteger(value)) return 'Enter a whole number.';
  if (!field.optional && value < 1) return 'Use at least 1.';
  return '';
}

export function to_settings(values: Values): TorrentSettings {
  const read = (field: NumberField) => {
    const text = values[field.key].trim();
    if (text === '') return null;
    return field.scale > 1 ? Math.round(Number(text) * field.scale) : Number(text);
  };
  const numbers = Object.fromEntries(NUMBER_FIELDS.map(field => [field.key, read(field)]));
  const optional = (text: string) => text.trim() || null;
  return { ...numbers, download_dir: values.download_dir.trim(), movie_dir: optional(values.movie_dir), series_dir: optional(values.series_dir) } as TorrentSettings;
}
