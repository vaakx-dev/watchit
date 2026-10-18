import { useId, useRef } from 'react';
import { ArrowDownUp, Check, ChevronDown } from 'lucide-react';
import { menu_step, popover_position } from '../menu';
import { LIBRARY_SORTS, type LibrarySort } from '../types';
import { SORT_LABELS } from './shelves';

export function SortMenu({ value, on_change }: { value: LibrarySort; on_change: (sort: LibrarySort) => void }) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);

  function place() {
    if (!trigger.current || !menu.current) return;
    const anchor = trigger.current.getBoundingClientRect();
    const panel = menu.current.getBoundingClientRect();
    const { top } = popover_position(anchor, panel, { width: window.innerWidth, height: window.innerHeight });
    menu.current.style.top = `${top}px`;
    menu.current.style.left = `${Math.max(12, anchor.right - panel.width)}px`;
    menu.current.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus({ preventScroll: true });
  }

  function choose(sort: LibrarySort) {
    menu.current?.hidePopover();
    trigger.current?.focus({ preventScroll: true });
    on_change(sort);
  }

  return <>
    <button type="button" className="myshows-tool" ref={trigger} popoverTarget={id} aria-haspopup="menu"
      aria-label={`Sort: ${SORT_LABELS[value].long}`} title={`Sort: ${SORT_LABELS[value].long}`}>
      <ArrowDownUp className="myshows-tool-icon" /><span className="myshows-tool-label">{SORT_LABELS[value].short}</span><ChevronDown className="myshows-tool-label" />
    </button>
    <div id={id} ref={menu} className="sort-menu" popover="auto" role="menu" aria-label="Sort"
      onToggle={event => { if (event.newState === 'open') place(); }}
      onKeyDown={event => {
        const items = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('button')];
        const next = menu_step(event.key, items.findIndex(item => item === document.activeElement), items.length);
        if (next === undefined) return;
        event.preventDefault();
        items[next]?.focus();
      }}>
      {LIBRARY_SORTS.map(sort => <button type="button" key={sort} role="menuitemradio" aria-checked={sort === value} onClick={() => choose(sort)}>
        {SORT_LABELS[sort].long}<Check />
      </button>)}
    </div>
  </>;
}
