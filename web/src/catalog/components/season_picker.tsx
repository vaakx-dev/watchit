import { Choices } from '../../ui/choices';
import { season_label } from '../episodes';

export function SeasonPicker({ seasons, value, on_change }: { seasons: readonly number[]; value: number; on_change: (season: number) => void }) {
  if (seasons.length < 2) return <span className="season-name">{season_label(value)}</span>;
  if (seasons.length > 6) return <select className="season-select" aria-label="Season" value={value} onChange={event => on_change(Number(event.currentTarget.value))}>
    {seasons.map(season => <option key={season} value={season}>{season_label(season)}</option>)}
  </select>;
  return <div className="season-picker">
    <Choices label="Season" look="segmented" value={String(value)} on_change={season => on_change(Number(season))}
      options={seasons.map(season => ({ value: String(season), label: season_label(season) }))} />
  </div>;
}
