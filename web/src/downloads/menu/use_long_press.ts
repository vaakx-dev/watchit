import { useRef, type MouseEvent, type PointerEvent } from 'react';

const HOLD_MS = 500;
const SLOP_PX = 10;

type Point = { x: number; y: number };
type Hold = Point & { timer: number };

export function use_long_press(on_press: (point: Point) => void) {
  const hold = useRef<Hold | null>(null);
  const pressed = useRef(false);

  function cancel() {
    if (hold.current) window.clearTimeout(hold.current.timer);
    hold.current = null;
  }

  function press(point: Point) {
    cancel();
    if (pressed.current) return;
    pressed.current = true;
    on_press(point);
  }

  return {
    onPointerDown(event: PointerEvent<HTMLElement>) {
      cancel();
      pressed.current = false;
      if (event.pointerType === 'mouse') return;
      const point = { x: event.clientX, y: event.clientY };
      hold.current = { ...point, timer: window.setTimeout(() => press(point), HOLD_MS) };
    },
    onPointerMove(event: PointerEvent<HTMLElement>) {
      const start = hold.current;
      if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > SLOP_PX) cancel();
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
    onContextMenu(event: MouseEvent<HTMLElement>) {
      event.preventDefault();
      press({ x: event.clientX, y: event.clientY });
    },
    onClickCapture(event: MouseEvent<HTMLElement>) {
      if (!pressed.current) return;
      event.preventDefault();
      event.stopPropagation();
      pressed.current = false;
    },
  };
}
