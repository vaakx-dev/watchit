import type { KeyboardEvent, PointerEvent } from 'react';
import { GripVertical } from 'lucide-react';

type DragEvents = {
  onPointerDown: (event: PointerEvent<HTMLElement>) => void;
  onPointerMove: (event: PointerEvent<HTMLElement>) => void;
  onPointerUp: () => void;
  onPointerCancel: () => void;
};

export function DragHandle({ name, index, count, events, on_move }: {
  name: string;
  index: number;
  count: number;
  events: DragEvents;
  on_move: (to: number) => void;
}) {
  const keys: Record<string, number> = { ArrowUp: index - 1, ArrowDown: index + 1, Home: 0, End: count - 1 };

  function key(event: KeyboardEvent) {
    const to = keys[event.key];
    if (to === undefined || to < 0 || to >= count || to === index) return;
    event.preventDefault();
    on_move(to);
  }

  return <button type="button" className="queue-handle" {...events} onKeyDown={key}
    aria-label={`Reorder ${name}, position ${index + 1} of ${count}`} title="Drag to reorder">
    <GripVertical />
  </button>;
}
