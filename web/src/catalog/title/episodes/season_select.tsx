import { ChevronDown } from 'lucide-react';
import { season_label } from '../../episodes';

export function SeasonSelect({ seasons, value, on_change }: { seasons: readonly number[]; value: number; on_change: (season: number) => void }) {
  if (seasons.length < 2) return <h2 className="season-title">{season_label(value)}</h2>;
  return <label className="season-title season-select">
    <select aria-label="Season" value={value} onChange={event => on_change(Number(event.currentTarget.value))}>
      {seasons.map(season => <option key={season} value={season}>{season_label(season)}</option>)}
    </select>
    <span aria-hidden="true">{season_label(value)}</span>
    <ChevronDown aria-hidden="true" />
  </label>;
}
