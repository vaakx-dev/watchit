const EDGE = 12;
const GAP = 6;

type Size = { width: number; height: number };
type Anchor = { top: number; bottom: number; left: number };

export function popover_position(anchor: Anchor, panel: Size, viewport: Size) {
  const room_below = viewport.height - EDGE - GAP - anchor.bottom;
  const room_above = anchor.top - GAP - EDGE;
  const below = panel.height <= room_below || room_below >= room_above;
  const top = below ? anchor.bottom + GAP : anchor.top - GAP - panel.height;
  return {
    left: Math.max(EDGE, Math.min(viewport.width - panel.width - EDGE, anchor.left)),
    top: Math.max(EDGE, Math.min(viewport.height - panel.height - EDGE, top)),
  };
}

export function menu_step(key: string, index: number, count: number): number | undefined {
  switch (key) {
    case 'ArrowDown': case 'ArrowRight': return (index + 1) % count;
    case 'ArrowUp': case 'ArrowLeft': return (index <= 0 ? count : index) - 1;
    case 'Home': return 0;
    case 'End': return count - 1;
    default: return undefined;
  }
}
