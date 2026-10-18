import { useRef, type PointerEvent } from 'react';

const DISMISS_DISTANCE = 64;

function panel(event: PointerEvent<HTMLElement>) {
  return event.currentTarget.closest<HTMLElement>('[popover]');
}

export function use_drag_dismiss(on_close: () => void) {
  const start = useRef<number | null>(null);

  function release(event: PointerEvent<HTMLElement>) {
    if (start.current === null) return;
    const distance = event.clientY - start.current;
    start.current = null;
    const sheet = panel(event);
    sheet?.style.removeProperty('transition');
    sheet?.style.removeProperty('translate');
    if (event.type === 'pointerup' && distance > DISMISS_DISTANCE) on_close();
  }

  return {
    onPointerDown(event: PointerEvent<HTMLElement>) {
      if (panel(event)?.dataset.layout !== 'sheet') return;
      start.current = event.clientY;
      event.currentTarget.setPointerCapture(event.pointerId);
      panel(event)?.style.setProperty('transition', 'none');
    },
    onPointerMove(event: PointerEvent<HTMLElement>) {
      if (start.current !== null) panel(event)?.style.setProperty('translate', `0 ${Math.max(0, event.clientY - start.current)}px`);
    },
    onPointerUp: release,
    onPointerCancel: release,
  };
}
