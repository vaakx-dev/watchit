import { isTauri } from '@tauri-apps/api/core';
import { ExternalLink } from 'lucide-react';
import { use_resource } from '../../catalog/api';
import type { About } from '../../generated/about/About';
import { SectionFrame } from '../controls/section_frame';
import { SettingGroup } from '../controls/setting_group';
import { SettingRow } from '../controls/setting_row';
import { UpdateSetting } from './update_setting';

const REPOSITORY = 'https://github.com/vaakx-dev/watchit';

export function AboutSection() {
  const { resource } = use_resource<About>('/api/about', { cache: false });
  const version = resource.status === 'ready' ? resource.data.version : '…';
  return <SectionFrame title="About">
    <SettingGroup>
      <SettingRow label="Version" hint={isTauri() ? undefined : 'Updates install through the Watchit app on the PC running the server.'}>
        <span className="setting-value">Watchit {version}</span>
      </SettingRow>
      {isTauri() && <UpdateSetting />}
      <SettingRow label="Release notes" hint="What changed in each version.">
        <a className="button secondary small" href={`${REPOSITORY}/releases`} target="_blank" rel="noreferrer"><ExternalLink />GitHub</a>
      </SettingRow>
    </SettingGroup>
  </SectionFrame>;
}
