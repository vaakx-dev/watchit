import { useRef, type MouseEvent, type PointerEvent } from 'react';

const HOLD_MS = 500;
const SLOP_PX = 10;

function in_popover(event: MouseEvent) {
  return event.target instanceof Element && event.target.closest('[popover]') !== null;
}

export function use_long_press(on_press: () => void) {
  const timer = useRef<number | undefined>(undefined);
  const start = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);

  function cancel() {
    window.clearTimeout(timer.current);
    start.current = null;
  }

  function fire() {
    cancel();
    fired.current = true;
    on_press();
  }

  return {
    onPointerDown(event: PointerEvent) {
      fired.current = false;
      if (event.pointerType !== 'touch' || !event.isPrimary || in_popover(event)) return;
      start.current = { x: event.clientX, y: event.clientY };
      timer.current = window.setTimeout(fire, HOLD_MS);
    },
    onPointerMove(event: PointerEvent) {
      if (start.current && Math.hypot(event.clientX - start.current.x, event.clientY - start.current.y) > SLOP_PX) cancel();
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
    onContextMenu(event: MouseEvent) {
      if (in_popover(event)) return;
      event.preventDefault();
      if (fired.current) return;
      if (start.current) fire();
      else on_press();
    },
    onClickCapture(event: MouseEvent) {
      if (!fired.current) return;
      fired.current = false;
      event.preventDefault();
      event.stopPropagation();
    },
  };
}
