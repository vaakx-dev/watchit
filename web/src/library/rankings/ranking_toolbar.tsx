import { Choices, type Choice } from '../../ui/choices';
import { KIND_CHOICES } from '../../catalog/kinds';
import type { RankingLayout, RankingsQuery } from '../../navigation/rankings';
import { SystemSwitch } from './system/system_switch';
import type { RankingSystem } from './system/use_ranking_system';

export const LAYOUTS: Record<RankingSystem, readonly Choice<RankingLayout>[]> = {
  stars: [{ value: 'ranked', label: 'Ranked' }, { value: 'tiers', label: 'Tiers' }],
  duels: [{ value: 'duel', label: 'Duel' }, { value: 'ranked', label: 'Ranked' }],
};

export function layout_of(system: RankingSystem, layout: RankingLayout | null): RankingLayout {
  const options = LAYOUTS[system];
  return options.find(option => option.value === layout)?.value ?? options[0]!.value;
}

type Props = {
  system: RankingSystem;
  layout: RankingLayout;
  query: RankingsQuery;
  change: (next: Partial<RankingsQuery>) => void;
  choose: (system: RankingSystem) => void;
};

export function RankingToolbar({ system, layout, query, change, choose }: Props) {
  return <div className="ranking-toolbar">
    <div className="ranking-modes">
      <SystemSwitch system={system} choose={choose} />
      <div className="filter-switch">
        <Choices look="segmented" label="Layout" options={LAYOUTS[system]} value={layout} on_change={layout => change({ layout })} />
      </div>
    </div>
    <Choices look="quiet" label="Type" options={KIND_CHOICES} value={query.kind} on_change={kind => change({ kind })} />
  </div>;
}
