import { Switch } from '../../../settings/controls/switch';
import type { RankingSystem } from './use_ranking_system';

export function SystemSwitch({ system, choose }: { system: RankingSystem; choose: (system: RankingSystem) => void }) {
  return <label className="ranking-system">
    Duels
    <Switch label="Duels" checked={system === 'duels'} on_change={on => choose(on ? 'duels' : 'stars')} />
  </label>;
}
