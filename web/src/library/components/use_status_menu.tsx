import { useId, useLayoutEffect, useRef, useState, type MouseEvent } from 'react';
import type { CatalogEntry } from '../../catalog/types';
import { menu_step, popover_position } from '../menu';
import { STATUS_LABELS } from '../status_labels';
import type { Library } from '../use_library';
import { StatusMenu } from './status_menu';

const SHEET = '(max-width: 640px), (pointer: coarse)';
const ITEMS = '.status-option, .flag-switch';

export type StatusMenuHandle = ReturnType<typeof use_status_menu>;

export function use_status_menu(title: CatalogEntry, library: Library) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [open, set_open] = useState(false);
  const entry = library.entries[title.id];
  const status = entry?.status ?? null;
  const favorite = entry?.favorite ?? false;
  const recommended = entry?.recommended ?? false;
  const label = `${status === null ? 'No watch status' : STATUS_LABELS[status]}${favorite ? ', favourite' : ''}${recommended ? ', recommended' : ''}`;

  function position() {
    if (!trigger.current || !menu.current) return;
    const { left, top } = popover_position(trigger.current.getBoundingClientRect(), menu.current.getBoundingClientRect(),
      { width: window.innerWidth, height: window.innerHeight });
    menu.current.style.left = `${left}px`;
    menu.current.style.top = `${top}px`;
  }

  useLayoutEffect(() => {
    const panel = menu.current;
    if (!open || !panel) return;
    const selected = panel.querySelector<HTMLButtonElement>('.status-option[aria-pressed="true"]') ?? panel.querySelector<HTMLButtonElement>(ITEMS);
    selected?.focus({ preventScroll: true });
    if (panel.dataset.layout === 'sheet') return;
    position();
    window.addEventListener('resize', position);
    window.addEventListener('scroll', position, { capture: true, passive: true });
    return () => {
      window.removeEventListener('resize', position);
      window.removeEventListener('scroll', position, true);
    };
  }, [open]);

  function show() {
    const panel = menu.current;
    if (!panel || !library.ready || panel.matches(':popover-open')) return;
    panel.removeAttribute('style');
    panel.dataset.layout = window.matchMedia(SHEET).matches ? 'sheet' : 'popover';
    panel.showPopover();
    set_open(true);
  }

  function close() {
    menu.current?.hidePopover();
    set_open(false);
    trigger.current?.focus({ preventScroll: true });
  }

  const trigger_props = {
    ref: trigger,
    disabled: !library.ready,
    popoverTarget: id,
    'aria-haspopup': 'dialog' as const,
    'aria-controls': id,
    'aria-expanded': open,
    onClick(event: MouseEvent<HTMLButtonElement>) {
      event.preventDefault();
      if (menu.current?.matches(':popover-open')) close();
      else show();
    },
  };

  const panel = <div id={id} ref={menu} className="status-menu" popover="auto" role="dialog" aria-label={`Watch status for ${title.title}`}
    onToggle={event => set_open(event.newState === 'open')}
    onKeyDown={event => {
      if (event.key === 'Escape' || event.key === 'Tab') {
        event.preventDefault();
        close();
        return;
      }
      const items = [...event.currentTarget.querySelectorAll<HTMLButtonElement>(ITEMS)];
      const next = menu_step(event.key, items.findIndex(item => item === document.activeElement), items.length);
      if (next === undefined) return;
      event.preventDefault();
      items[next]?.focus();
    }}>
    {open && <StatusMenu title={title.title} status={status} favorite={favorite} recommended={recommended} disabled={!library.ready} on_close={close}
      on_status={next => {
        close();
        void library.update(title.id, { status: next });
      }}
      on_favorite={() => { void library.update(title.id, { favorite: !favorite }); }}
      on_recommended={() => { void library.update(title.id, { recommended: !recommended }); }} />}
  </div>;

  return { status, favorite, recommended, label, trigger_props, panel, show };
}
