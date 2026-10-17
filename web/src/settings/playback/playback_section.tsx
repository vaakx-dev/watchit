import { isTauri } from '@tauri-apps/api/core';
import { set_remaining_time, use_remaining_time } from '../../playback/player/remaining_time';
import { SectionFrame } from '../controls/section_frame';
import { SettingGroup } from '../controls/setting_group';
import { SettingRow } from '../controls/setting_row';
import { Switch } from '../controls/switch';

const PLAYER = isTauri()
  ? 'This app plays every video directly with mpv, including 4K, HDR and surround sound.'
  : 'This browser plays what it can directly. The server converts the rest as it plays.';

export function PlaybackSection() {
  const remaining = use_remaining_time();
  return <SectionFrame title="Playback" intro={PLAYER}>
    <SettingGroup>
      <SettingRow id="remaining-time" label="Show time left" hint="The player clock counts down instead of up. Saved on this device.">
        <Switch id="remaining-time" label="Show time left" checked={remaining} on_change={set_remaining_time} />
      </SettingRow>
    </SettingGroup>
  </SectionFrame>;
}
