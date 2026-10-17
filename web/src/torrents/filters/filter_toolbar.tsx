import { ArrowDownUp, SlidersHorizontal } from 'lucide-react';
import { active_filters } from './filter_state';
import { SORT_LABELS, type SortKey } from './sort';
import type { TorrentFilterState } from './use_torrent_filters';

type Props = { state: TorrentFilterState; open: boolean; on_toggle: () => void };

export function FilterToolbar({ state, open, on_toggle }: Props) {
  const active = active_filters(state.filters);
  return <div className="torrent-toolbar">
    <button type="button" className="button secondary small" aria-expanded={open} onClick={on_toggle}>
      <SlidersHorizontal />Filters{active > 0 && <span className="filter-count">{active}</span>}
    </button>
    <label className="torrent-sort">
      <ArrowDownUp aria-hidden="true" />
      <span className="sr-only">Sort by</span>
      <select value={state.sort} onChange={event => state.set_sort(event.target.value as SortKey)}>
        {(Object.keys(SORT_LABELS) as SortKey[]).map(key => <option key={key} value={key}>{SORT_LABELS[key]}</option>)}
      </select>
    </label>
    <span className="torrent-count" role="status">
      {state.shown.length === state.total ? `${state.total} results` : `${state.shown.length} of ${state.total}`}
    </span>
  </div>;
}
