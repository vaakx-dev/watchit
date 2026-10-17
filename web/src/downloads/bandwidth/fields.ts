import type { NumberField } from '../settings/fields';
import type { SpeedSchedule, TorrentSettings } from '../../torrents/types';

const MIB = 1024 ** 2;

export const ALTERNATIVE_FIELDS: NumberField[] = [
  { key: 'alt_download_bps', label: 'Alternative download limit', unit: 'MiB/s', hint: 'Leave empty for no limit.', scale: MIB, optional: true, integer: false },
  { key: 'alt_upload_bps', label: 'Alternative upload limit', unit: 'MiB/s', hint: 'Leave empty for no limit.', scale: MIB, optional: true, integer: false },
];

export const BACKGROUND_FIELD: NumberField = {
  key: 'while_watching_bps',
  label: 'Background speed',
  unit: 'MiB/s',
  hint: 'Background downloads run in turns that average this speed.',
  scale: MIB,
  optional: false,
  integer: false,
};

export const BANDWIDTH_FIELDS = [...ALTERNATIVE_FIELDS, BACKGROUND_FIELD];

export type SpeedSettings = Pick<TorrentSettings, 'schedule' | 'while_watching'>;

export function to_speed_settings(settings: TorrentSettings): SpeedSettings {
  return { schedule: settings.schedule, while_watching: settings.while_watching };
}

export function schedule_error(schedule: SpeedSchedule) {
  if (!schedule.enabled) return '';
  if (!schedule.days.length) return 'Pick at least one day.';
  if (!schedule.from || !schedule.to) return 'Enter both times.';
  return '';
}
