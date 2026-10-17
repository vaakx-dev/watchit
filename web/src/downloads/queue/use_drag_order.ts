import { useRef, useState, type PointerEvent } from 'react';

type Drag = { from: number; to: number };

function target_index(list: HTMLElement, y: number) {
  const rows = [...list.querySelectorAll<HTMLElement>('[data-queue-row]')];
  const index = rows.findIndex(row => {
    const box = row.getBoundingClientRect();
    return y < box.top + box.height / 2;
  });
  return index === -1 ? rows.length - 1 : index;
}

export function use_drag_order(on_drop: (from: number, to: number) => void) {
  const list = useRef<HTMLOListElement>(null);
  const [drag, set_drag] = useState<Drag | null>(null);

  function start(index: number, event: PointerEvent<HTMLElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    set_drag({ from: index, to: index });
  }

  function move(event: PointerEvent<HTMLElement>) {
    if (!drag || !list.current) return;
    const to = target_index(list.current, event.clientY);
    if (to !== drag.to) set_drag({ ...drag, to });
  }

  function end() {
    if (drag && drag.from !== drag.to) on_drop(drag.from, drag.to);
    set_drag(null);
  }

  return { list, drag, handle: (index: number) => ({
    onPointerDown: (event: PointerEvent<HTMLElement>) => start(index, event),
    onPointerMove: move,
    onPointerUp: end,
    onPointerCancel: () => set_drag(null),
  }) };
}
