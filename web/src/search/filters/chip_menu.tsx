import { useId, useLayoutEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { menu_step, popover_position } from '../../library/menu';

export type MenuOption = { value: string; label: string; checked: boolean };

type Props = {
  label: string;
  active: boolean;
  options: readonly MenuOption[];
  multiple?: boolean;
  on_select: (value: string) => void;
};

export function ChipMenu({ label, active, options, multiple = false, on_select }: Props) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [open, set_open] = useState(false);

  useLayoutEffect(() => {
    const panel = menu.current;
    if (!open || !panel || !trigger.current) return;
    const { left, top } = popover_position(trigger.current.getBoundingClientRect(), panel.getBoundingClientRect(),
      { width: window.innerWidth, height: window.innerHeight });
    panel.style.left = `${left}px`;
    panel.style.top = `${top}px`;
    (panel.querySelector<HTMLElement>('[aria-checked="true"]') ?? panel.querySelector<HTMLElement>('[role^="menuitem"]'))?.focus();
  }, [open]);

  function close() {
    menu.current?.hidePopover();
    trigger.current?.focus({ preventScroll: true });
  }

  return <>
    <button type="button" ref={trigger} className="chip-menu-trigger" data-active={active || undefined} popoverTarget={id}
      aria-haspopup="menu" aria-expanded={open}>{label}<ChevronDown /></button>
    <div id={id} ref={menu} className="chip-menu" popover="auto" role="menu" aria-label={label}
      onToggle={event => set_open(event.newState === 'open')}
      onKeyDown={event => {
        if (event.key === 'Tab') return close();
        const items = [...event.currentTarget.querySelectorAll<HTMLElement>('[role^="menuitem"]')];
        const next = menu_step(event.key, items.indexOf(document.activeElement as HTMLElement), items.length);
        if (next === undefined) return;
        event.preventDefault();
        items[next]?.focus();
      }}>
      {options.map(option => <button type="button" key={option.value} role={multiple ? 'menuitemcheckbox' : 'menuitemradio'}
        aria-checked={option.checked} onClick={() => {
          on_select(option.value);
          if (!multiple) close();
        }}>{option.label}<Check /></button>)}
    </div>
  </>;
}
