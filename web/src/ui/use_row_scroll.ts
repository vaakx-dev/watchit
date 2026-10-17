import { useEffect, type RefObject } from 'react';

const DRAG_THRESHOLD = 5;
const FRICTION = 0.95;
const MIN_SPEED = 0.02;
const LINE_HEIGHT = 16;

export function useRowScroll(row: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const element = row.current;
    if (!element) return;
    const row_element = element;
    let momentum = 0;

    function stop_momentum() {
      cancelAnimationFrame(momentum);
      row_element.style.scrollSnapType = '';
    }

    function on_wheel(event: WheelEvent) {
      if (event.ctrlKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
      const unit = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? LINE_HEIGHT : event.deltaMode === WheelEvent.DOM_DELTA_PAGE ? row_element.clientWidth : 1;
      const delta = event.deltaY * unit;
      const max = row_element.scrollWidth - row_element.clientWidth;
      if (max <= 0 || (delta < 0 && row_element.scrollLeft <= 0) || (delta > 0 && row_element.scrollLeft >= max - 1)) return;
      event.preventDefault();
      stop_momentum();
      row_element.scrollLeft += delta;
    }

    function on_pointer_down(event: PointerEvent) {
      if (event.pointerType !== 'mouse' || event.button !== 0 || row_element.scrollWidth <= row_element.clientWidth) return;
      stop_momentum();
      const start_x = event.clientX;
      const start_left = row_element.scrollLeft;
      let last_x = event.clientX;
      let last_time = event.timeStamp;
      let velocity = 0;
      let dragging = false;

      function on_move(move: PointerEvent) {
        if (!dragging) {
          if (Math.abs(move.clientX - start_x) < DRAG_THRESHOLD) return;
          dragging = true;
          row_element.setPointerCapture(event.pointerId);
          row_element.style.scrollSnapType = 'none';
          row_element.style.cursor = 'grabbing';
          row_element.style.userSelect = 'none';
        }
        const elapsed = Math.max(move.timeStamp - last_time, 1);
        velocity = 0.8 * velocity + 0.2 * ((last_x - move.clientX) / elapsed);
        last_x = move.clientX;
        last_time = move.timeStamp;
        row_element.scrollLeft = start_left + start_x - move.clientX;
      }

      function glide(previous: number) {
        return (now: number) => {
          const step = now - previous;
          velocity *= Math.pow(FRICTION, step / 16);
          const before = row_element.scrollLeft;
          row_element.scrollLeft += velocity * step;
          if (Math.abs(velocity) < MIN_SPEED || row_element.scrollLeft === before) return stop_momentum();
          momentum = requestAnimationFrame(glide(now));
        };
      }

      function on_up(up: PointerEvent) {
        row_element.removeEventListener('pointermove', on_move);
        window.removeEventListener('pointerup', on_up);
        window.removeEventListener('pointercancel', on_up);
        if (!dragging) return;
        row_element.releasePointerCapture(event.pointerId);
        row_element.style.cursor = '';
        row_element.style.userSelect = '';
        row_element.addEventListener('click', swallow, { capture: true, once: true });
        setTimeout(() => row_element.removeEventListener('click', swallow, true));
        const idle = up.timeStamp - last_time > 80;
        if (idle || Math.abs(velocity) < MIN_SPEED) return stop_momentum();
        momentum = requestAnimationFrame(glide(performance.now()));
      }

      row_element.addEventListener('pointermove', on_move);
      window.addEventListener('pointerup', on_up);
      window.addEventListener('pointercancel', on_up);
    }

    function swallow(event: Event) {
      event.preventDefault();
      event.stopPropagation();
    }

    function on_drag_start(event: DragEvent) {
      event.preventDefault();
    }

    row_element.addEventListener('wheel', on_wheel, { passive: false });
    row_element.addEventListener('pointerdown', on_pointer_down);
    row_element.addEventListener('dragstart', on_drag_start);
    return () => {
      stop_momentum();
      row_element.removeEventListener('wheel', on_wheel);
      row_element.removeEventListener('pointerdown', on_pointer_down);
      row_element.removeEventListener('dragstart', on_drag_start);
    };
  }, [row]);
}
