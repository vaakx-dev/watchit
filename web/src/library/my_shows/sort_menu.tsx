import { useId, useRef, useState } from 'react';
import { ArrowDownUp, Check, ChevronDown } from 'lucide-react';
import { Sheet } from '../../ui/sheet/sheet';
import { LIBRARY_SORTS, type LibrarySort } from '../types';
import { SORT_LABELS } from './shelves';

export function SortMenu({ value, set, on_change }: { value: LibrarySort; set: boolean; on_change: (sort: LibrarySort) => void }) {
  const id = useId();
  const anchor = useRef<HTMLButtonElement>(null);
  const [open, set_open] = useState(false);
  const label = `Sort: ${SORT_LABELS[value].long}`;

  return <>
    <button type="button" className="myshows-tool" data-set={set || undefined} ref={anchor} popoverTarget={id} aria-controls={id}
      aria-haspopup="dialog" aria-expanded={open} aria-label={label} title={label}
      onClick={event => { event.preventDefault(); set_open(!open); }}>
      <ArrowDownUp className="myshows-tool-icon" /><span className="myshows-tool-label">{SORT_LABELS[value].short}</span>
      <ChevronDown className="myshows-tool-label" />
    </button>
    <Sheet id={id} title="Sort" open={open} anchor={anchor} on_close={() => set_open(false)} className="myshows-sort-sheet">
      <div className="sheet-options" role="group" aria-label="Sort">
        {LIBRARY_SORTS.map(sort => <button type="button" key={sort} className="sheet-option" aria-pressed={sort === value}
          onClick={() => { set_open(false); on_change(sort); }}>
          {SORT_LABELS[sort].long}<Check />
        </button>)}
      </div>
    </Sheet>
  </>;
}
