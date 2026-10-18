import { useLayoutEffect, useRef, type KeyboardEvent } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Artwork } from '../../catalog/components/artwork';
import { menu_step, popover_position } from '../../library/menu';
import './menu.css';

export type MenuAction = { label: string; icon: LucideIcon; danger?: boolean; run: () => void };
export type MenuAnchor = { top: number; bottom: number; right: number };
export type MenuHeading = { artwork: string; name: string; detail: string };

const SHEET = '(max-width: 760px), (pointer: coarse)';

function place(menu: HTMLElement, anchor: MenuAnchor) {
  const size = menu.getBoundingClientRect();
  const { left, top } = popover_position({ ...anchor, left: anchor.right - size.width }, size, { width: window.innerWidth, height: window.innerHeight });
  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;
}

function step(event: KeyboardEvent<HTMLElement>) {
  const items = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')];
  const next = menu_step(event.key, items.findIndex(item => item === document.activeElement), items.length);
  if (next === undefined) return;
  event.preventDefault();
  items[next]?.focus();
}

export function ActionMenu({ heading, actions, anchor, on_close }: {
  heading: MenuHeading;
  actions: MenuAction[];
  anchor: MenuAnchor;
  on_close: () => void;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const opener = useRef(document.activeElement instanceof HTMLElement ? document.activeElement : null);

  useLayoutEffect(() => {
    const menu = panel.current;
    if (!menu) return;
    const sheet = window.matchMedia(SHEET).matches;
    menu.dataset.layout = sheet ? 'sheet' : 'popover';
    menu.showPopover();
    menu.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus({ preventScroll: true });
    if (sheet) return;
    place(menu, anchor);
    const close = () => menu.hidePopover();
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, { capture: true, passive: true });
    return () => {
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close, true);
    };
  }, [anchor]);

  function choose(action: MenuAction) {
    panel.current?.hidePopover();
    action.run();
  }

  return <div ref={panel} className="action-menu" popover="auto" role="menu" aria-label={`Actions for ${heading.name}`}
    onToggle={event => {
      if (event.newState !== 'closed') return;
      opener.current?.focus({ preventScroll: true });
      on_close();
    }} onKeyDown={step}>
    <header className="action-menu-head">
      <span className="action-menu-grab" aria-hidden="true" />
      <span className="download-poster"><Artwork src={heading.artwork} label={heading.name} /></span>
      <span className="action-menu-title">
        <strong>{heading.name}</strong>
        {heading.detail && <span>{heading.detail}</span>}
      </span>
    </header>
    {actions.map(action => <button type="button" role="menuitem" key={action.label} className="action-menu-item"
      data-danger={action.danger || undefined} onClick={() => choose(action)}>
      <action.icon aria-hidden="true" />{action.label}
    </button>)}
  </div>;
}
