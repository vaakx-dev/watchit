import type { WhileWatching } from '../../torrents/types';
import { Choices } from '../../ui/choices';
import { NumberInput, type NumberSpec } from '../controls/number_input';
import { Loading, SectionFrame } from '../controls/section_frame';
import { SettingGroup } from '../controls/setting_group';
import { SettingRow } from '../controls/setting_row';
import { use_torrent_settings } from '../torrents/use_torrent_settings';
import { ScheduleSetting } from './schedule_setting';

const MB = 1024 ** 2;
const limit = (id: string, label: string, hint: string): NumberSpec => ({ id, label, hint, unit: 'MB/s', scale: MB, empty: 'No limit' });

const DOWNLOAD = limit('max_download', 'Download limit', 'Leave empty for full speed.');
const UPLOAD = limit('max_upload', 'Upload limit', 'Leave empty for full speed.');
const ALT_DOWNLOAD = limit('alt_download', 'Download limit', 'Used while alternative speed is on.');
const ALT_UPLOAD = limit('alt_upload', 'Upload limit', 'Used while alternative speed is on.');
const BACKGROUND: NumberSpec = { id: 'while_watching_speed', label: 'Background speed', hint: 'Shared by the other downloads.', unit: 'MB/s', scale: MB, min: 0.1 };

const WATCHING: { value: WhileWatching; label: string }[] = [
  { value: 'pause', label: 'Pause' },
  { value: 'throttle', label: 'Slow down' },
  { value: 'none', label: 'Keep going' },
];

const WATCHING_HINTS: Record<WhileWatching, string> = {
  pause: 'They resume 15 seconds after the video stops.',
  throttle: 'They keep going at the background speed.',
  none: 'They keep their normal speed.',
};

export function SpeedSection() {
  const { settings, error, retry, saving, save } = use_torrent_settings();
  return <SectionFrame title="Speed" saving={saving}>
    {settings ? <>
      <SettingGroup>
        <NumberInput spec={DOWNLOAD} value={settings.max_download_bps} on_save={max_download_bps => save({ max_download_bps })} />
        <NumberInput spec={UPLOAD} value={settings.max_upload_bps} on_save={max_upload_bps => save({ max_upload_bps })} />
      </SettingGroup>
      <SettingGroup title="Alternative speed">
        <NumberInput spec={ALT_DOWNLOAD} value={settings.alt_download_bps} on_save={alt_download_bps => save({ alt_download_bps })} />
        <NumberInput spec={ALT_UPLOAD} value={settings.alt_upload_bps} on_save={alt_upload_bps => save({ alt_upload_bps })} />
        <ScheduleSetting schedule={settings.schedule} on_save={schedule => save({ schedule })} />
      </SettingGroup>
      <SettingGroup title="While you watch">
        <SettingRow label="Other downloads" hint={WATCHING_HINTS[settings.while_watching]}>
          <Choices label="Other downloads while you watch" look="segmented" options={WATCHING} value={settings.while_watching}
            on_change={while_watching => save({ while_watching })} />
        </SettingRow>
        {settings.while_watching === 'throttle' && <NumberInput spec={BACKGROUND} value={settings.while_watching_bps}
          on_save={while_watching_bps => save({ while_watching_bps })} />}
      </SettingGroup>
    </> : <Loading error={error} retry={retry} />}
  </SectionFrame>;
}
