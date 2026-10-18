import { LayoutGrid, List } from 'lucide-react';
import { KIND_CHOICES } from '../../catalog/kinds';
import type { CatalogKind } from '../../catalog/types';
import { Choices } from '../../ui/choices';
import type { LibrarySort } from '../types';
import type { View } from './shelves';
import { SortMenu } from './sort_menu';

export function Tools({ kind, sort, sort_set, view, on_kind, on_sort, on_view }: {
  kind: CatalogKind;
  sort: LibrarySort;
  sort_set: boolean;
  view: View;
  on_kind: (kind: CatalogKind) => void;
  on_sort: (sort: LibrarySort) => void;
  on_view: (view: View) => void;
}) {
  const next = view === 'list' ? 'grid' : 'list';

  return <div className="myshows-tools">
    <Choices label="Type" look="quiet" options={KIND_CHOICES} value={kind} on_change={on_kind} />
    <div className="myshows-tool-buttons">
      <SortMenu value={sort} set={sort_set} on_change={on_sort} />
      <button type="button" className="myshows-tool" aria-label={`Show as ${next}`} title={`Show as ${next}`} onClick={() => on_view(next)}>
        {next === 'grid' ? <LayoutGrid /> : <List />}
      </button>
    </div>
  </div>;
}
