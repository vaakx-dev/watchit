import { use_ranking_system } from '../../library/rankings/system/use_ranking_system';
import { Loading, SectionFrame } from '../controls/section_frame';
import { SettingGroup } from '../controls/setting_group';
import { SettingRow } from '../controls/setting_row';
import { Switch } from '../controls/switch';

export function RankingsSection() {
  const ranking = use_ranking_system();
  if (!ranking.system) return <SectionFrame title="Rankings"><Loading error={ranking.error ?? null} retry={ranking.retry} /></SectionFrame>;
  const duels = ranking.system === 'duels';
  return <SectionFrame title="Rankings">
    <SettingGroup>
      <SettingRow id="ranking-duels" label="Rank with duels" error={ranking.failure ?? undefined}>
        <Switch id="ranking-duels" label="Rank with duels" checked={duels} on_change={on => void ranking.choose(on ? 'duels' : 'stars')} />
      </SettingRow>
    </SettingGroup>
  </SectionFrame>;
}
