import { useLayoutEffect, useRef, type ReactNode, type RefObject } from 'react';
import { popover_position } from '../../library/menu';
import { use_drag_dismiss } from './use_drag_dismiss';

export const SHEET_QUERY = '(max-width: 640px), (pointer: coarse)';

type Props = {
  id: string;
  title: string;
  open: boolean;
  anchor: RefObject<HTMLElement | null>;
  on_close: () => void;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
};

export function Sheet({ id, title, open, anchor, on_close, action, className = '', children }: Props) {
  const panel = useRef<HTMLDivElement>(null);
  const drag = use_drag_dismiss(on_close);

  useLayoutEffect(() => {
    const element = panel.current;
    if (!element) return;
    if (!open) {
      if (element.matches(':popover-open')) element.hidePopover();
      return;
    }
    element.removeAttribute('style');
    element.dataset.layout = window.matchMedia(SHEET_QUERY).matches ? 'sheet' : 'popover';
    element.showPopover();
    element.querySelector<HTMLElement>('[aria-pressed="true"], [aria-checked="true"]')?.focus({ preventScroll: true });
    if (element.dataset.layout === 'sheet') return;

    function place() {
      if (!element || !anchor.current) return;
      const { left, top } = popover_position(anchor.current.getBoundingClientRect(), element.getBoundingClientRect(),
        { width: window.innerWidth, height: window.innerHeight });
      element.style.left = `${left}px`;
      element.style.top = `${top}px`;
    }

    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, { capture: true, passive: true });
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, anchor]);

  return <div id={id} ref={panel} className={`sheet ${className}`} popover="auto" role="dialog" aria-label={title}
    onToggle={event => { if (event.newState === 'closed' && open) on_close(); }}>
    <div className="sheet-header">
      <div className="sheet-grab" {...drag}>
        <span className="sheet-handle" aria-hidden="true" />
        <h2>{title}</h2>
      </div>
      {action}
    </div>
    {children}
  </div>;
}
