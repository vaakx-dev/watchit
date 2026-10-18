import { useRef, type MouseEvent, type PointerEvent } from 'react';

const DELAY_MS = 450;
const SLOP = 10;

export type Point = { x: number; y: number };

export function use_long_press(on_press: (point: Point) => void) {
  const timer = useRef<number | undefined>(undefined);
  const start = useRef<Point>({ x: 0, y: 0 });
  const held = useRef(false);
  const fired = useRef(false);

  function cancel() {
    window.clearTimeout(timer.current);
    timer.current = undefined;
  }

  function release() {
    cancel();
    if (!held.current) return;
    held.current = false;
    const point = start.current;
    window.setTimeout(() => on_press(point));
  }

  return {
    onPointerDown(event: PointerEvent<HTMLElement>) {
      if (event.pointerType === 'mouse') return;
      fired.current = false;
      start.current = { x: event.clientX, y: event.clientY };
      timer.current = window.setTimeout(() => {
        timer.current = undefined;
        held.current = true;
        fired.current = true;
        navigator.vibrate?.(10);
      }, DELAY_MS);
    },
    onPointerMove(event: PointerEvent<HTMLElement>) {
      if (timer.current !== undefined && Math.hypot(event.clientX - start.current.x, event.clientY - start.current.y) > SLOP) cancel();
    },
    onPointerUp: release,
    onPointerCancel: release,
    onContextMenu(event: MouseEvent<HTMLElement>) {
      if (timer.current !== undefined || fired.current) event.preventDefault();
    },
    onClickCapture(event: MouseEvent<HTMLElement>) {
      if (!fired.current) return;
      fired.current = false;
      event.preventDefault();
      event.stopPropagation();
    },
  };
}
