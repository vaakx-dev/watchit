import { Check } from 'lucide-react';
import type { Facet } from './facets';
import { active_filters, NO_FILTERS, toggle_facet, type TorrentFilters } from './filter_state';
import { RangeField } from './range_field';
import type { TorrentFilterState } from './use_torrent_filters';

function FacetRow({ facet, filters, on_change }: { facet: Facet; filters: TorrentFilters; on_change: (next: TorrentFilters) => void }) {
  const selected = filters.facets[facet.key] ?? [];
  return <div className="filter-row">
    <span className="filter-label" aria-hidden="true">{facet.label}</span>
    <div className="choices chips" role="group" aria-label={facet.label}>
      {facet.options.map(option => {
        const on = selected.includes(option.value);
        return <button type="button" key={option.value} aria-pressed={on} onClick={() => on_change(toggle_facet(filters, facet.key, option.value))}>
          {on && <Check />}{option.label}<small>{option.count}</small>
        </button>;
      })}
    </div>
  </div>;
}

export function FilterPanel({ state }: { state: TorrentFilterState }) {
  const { filters, set_filters } = state;
  return <div className="filter-panel">
    {state.facets.map(facet => <FacetRow key={facet.key} facet={facet} filters={filters} on_change={set_filters} />)}
    <div className="filter-row">
      <span className="filter-label" aria-hidden="true">Size</span>
      <div className="filter-ranges" role="group" aria-label="Size">
        <RangeField label="Min" unit="GB" value={filters.min_gb} on_change={min_gb => set_filters({ ...filters, min_gb })} />
        <RangeField label="Max" unit="GB" value={filters.max_gb} on_change={max_gb => set_filters({ ...filters, max_gb })} />
      </div>
    </div>
    <div className="filter-row">
      <span className="filter-label" aria-hidden="true">Seeders</span>
      <div className="filter-ranges" role="group" aria-label="Seeders">
        <RangeField label="At least" value={filters.min_seeders} on_change={min_seeders => set_filters({ ...filters, min_seeders })} />
        {active_filters(filters) > 0 && <button type="button" className="button ghost small" onClick={() => set_filters(NO_FILTERS)}>Clear filters</button>}
      </div>
    </div>
  </div>;
}
