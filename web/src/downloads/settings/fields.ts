import type { TorrentSettings } from '../../torrents/types';
import { BANDWIDTH_FIELDS } from '../bandwidth/fields';

export type NumberKey = Exclude<{ [K in keyof TorrentSettings]: TorrentSettings[K] extends number | null ? K : never }[keyof TorrentSettings], 'max_active'>;

export type NumberField = { key: NumberKey; label: string; unit: string; hint: string; scale: number; optional: boolean; integer: boolean };

const GIB = 1024 ** 3;
const MIB = 1024 ** 2;

export const NUMBER_FIELDS: NumberField[] = [
  { key: 'disk_budget_bytes', label: 'Space for downloads', unit: 'GiB', hint: 'The most Watchit keeps on each drive. Leave empty to use any free space.', scale: GIB, optional: true, integer: false },
  { key: 'max_download_bps', label: 'Download speed limit', unit: 'MiB/s', hint: 'Leave empty for no limit.', scale: MIB, optional: true, integer: false },
  { key: 'max_upload_bps', label: 'Upload speed limit', unit: 'MiB/s', hint: 'Leave empty for no limit.', scale: MIB, optional: true, integer: false },
  { key: 'seed_ratio', label: 'Stop seeding at ratio', unit: '×', hint: 'Uploaded divided by downloaded. Leave empty to keep seeding.', scale: 1, optional: true, integer: false },
  { key: 'seed_minutes', label: 'Stop seeding after', unit: 'min', hint: 'Leave empty to keep seeding.', scale: 1, optional: true, integer: true },
];

const FIELDS = [...NUMBER_FIELDS, ...BANDWIDTH_FIELDS];

export type Values = Record<NumberKey | 'download_dir', string>;

export type Errors = Record<NumberKey, string>;

function shown(value: number | null, scale: number) {
  if (value === null) return '';
  return String(Number((value / scale).toFixed(2)));
}

export function to_values(settings: TorrentSettings): Values {
  const numbers = Object.fromEntries(FIELDS.map(field => [field.key, shown(settings[field.key], field.scale)]));
  return { ...numbers, download_dir: settings.download_dir } as Values;
}

function field_error(field: NumberField, text: string) {
  if (text.trim() === '') return field.optional ? '' : 'Enter a number.';
  const value = Number(text);
  if (!Number.isFinite(value) || value < 0) return 'Enter a positive number.';
  if (field.integer && !Number.isInteger(value)) return 'Enter a whole number.';
  if (!field.optional && value < 1) return 'Use at least 1.';
  return '';
}

export function field_errors(values: Values): Errors {
  return Object.fromEntries(FIELDS.map(field => [field.key, field_error(field, values[field.key])])) as Errors;
}

export function to_settings(values: Values): Partial<TorrentSettings> {
  const read = (field: NumberField) => {
    const text = values[field.key].trim();
    if (text === '') return null;
    return field.scale > 1 ? Math.round(Number(text) * field.scale) : Number(text);
  };
  const numbers = Object.fromEntries(FIELDS.map(field => [field.key, read(field)]));
  return { ...numbers, download_dir: values.download_dir.trim() } as Partial<TorrentSettings>;
}
