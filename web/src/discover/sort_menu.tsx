import { useId, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { MenuChip } from '../ui/filters/filter_chips';
import { Sheet } from '../ui/sheet/sheet';
import { SORT_LABELS } from '../catalog/sort_labels';
import type { CatalogSort } from '../catalog/types';
export function SortMenu({ sorts, value, fallback, on_change }: {
  sorts: readonly CatalogSort[];
  value: CatalogSort;
  fallback: CatalogSort;
  on_change: (sort: CatalogSort) => void;
}) {
  const id = useId();
  const anchor = useRef<HTMLButtonElement>(null);
  const [open, set_open] = useState(false);

  return <>
    <MenuChip label={SORT_LABELS[value]} set={value !== fallback} open={open} ref={anchor}
      popoverTarget={id} aria-controls={id} aria-label={`Sort: ${SORT_LABELS[value]}`}
      onClick={event => { event.preventDefault(); set_open(!open); }} />
    <Sheet id={id} title="Sort" open={open} anchor={anchor} on_close={() => set_open(false)} className="sort-sheet">
      <div className="sheet-options" role="group" aria-label="Sort">
        {sorts.map(sort => <button type="button" key={sort} className="sheet-option" aria-pressed={sort === value}
          onClick={() => { set_open(false); on_change(sort); }}>
          {SORT_LABELS[sort]}<Check />
        </button>)}
      </div>
    </Sheet>
  </>;
}
