import { NumberInput, type NumberSpec } from '../controls/number_input';
import { Loading, SectionFrame } from '../controls/section_frame';
import { SettingGroup } from '../controls/setting_group';
import { SettingRow } from '../controls/setting_row';
import { Stepper } from '../controls/stepper';
import { use_torrent_settings } from '../torrents/use_torrent_settings';
import { FolderSetting } from './folder_setting';

const GB = 1024 ** 3;
const MAX_ACTIVE = 20;

const BUDGET: NumberSpec = { id: 'disk_budget', label: 'Space for downloads', hint: 'The most space downloads may use.', unit: 'GB', scale: GB, empty: 'No limit' };
const RATIO: NumberSpec = { id: 'seed_ratio', label: 'Stop at ratio', hint: 'Uploaded divided by downloaded.', unit: '×', empty: 'Never' };
const MINUTES: NumberSpec = { id: 'seed_minutes', label: 'Stop after', hint: 'Time spent seeding once finished.', unit: 'min', integer: true, empty: 'Never' };

export function DownloadsSection() {
  const { settings, error, retry, saving, save } = use_torrent_settings();
  return <SectionFrame title="Downloads" saving={saving}>
    {settings ? <>
      <SettingGroup>
        <FolderSetting folder={settings.download_dir} on_save={download_dir => save({ download_dir })} />
        <NumberInput spec={BUDGET} value={settings.disk_budget_bytes} on_save={disk_budget_bytes => save({ disk_budget_bytes })} />
      </SettingGroup>
      <SettingGroup title="Queue">
        <SettingRow label="Downloads at once" hint="The rest wait their turn in the queue.">
          <Stepper label="Downloads at once" value={settings.max_active} min={1} max={MAX_ACTIVE} on_change={max_active => save({ max_active })} />
        </SettingRow>
      </SettingGroup>
      <SettingGroup title="Seeding">
        <NumberInput spec={RATIO} value={settings.seed_ratio} on_save={seed_ratio => save({ seed_ratio })} />
        <NumberInput spec={MINUTES} value={settings.seed_minutes} on_save={seed_minutes => save({ seed_minutes })} />
      </SettingGroup>
    </> : <Loading error={error} retry={retry} />}
  </SectionFrame>;
}
