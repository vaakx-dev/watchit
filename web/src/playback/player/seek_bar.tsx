import { useRef, useState, type PointerEvent } from 'react';
import type { TimeRange } from '../engine/types';
import { clock } from './clock';

type Props = { time: number; duration: number | null; buffered: TimeRange[]; on_seek: (seconds: number) => void; on_drag: (dragging: boolean) => void };

const share = (value: number, duration: number) => `${Math.min(Math.max(value / duration, 0), 1) * 100}%`;

export function SeekBar({ time, duration, buffered, on_seek, on_drag }: Props) {
  const bar = useRef<HTMLDivElement>(null);
  const [hover, set_hover] = useState<number | null>(null);
  const [drag, set_drag] = useState<number | null>(null);
  const length = duration && duration > 0 ? duration : null;

  function at(event: PointerEvent) {
    const box = bar.current!.getBoundingClientRect();
    return Math.min(Math.max((event.clientX - box.left) / box.width, 0), 1) * (length ?? 0);
  }

  function down(event: PointerEvent<HTMLDivElement>) {
    if (!length || event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    set_drag(at(event));
    on_drag(true);
  }

  function up(event: PointerEvent<HTMLDivElement>) {
    if (drag === null) return;
    on_seek(at(event));
    set_drag(null);
    on_drag(false);
  }

  const shown = drag ?? time;
  return <div ref={bar} className="seek-bar" role="slider" tabIndex={0} aria-label="Seek" aria-valuemin={0} aria-valuemax={Math.round(length ?? 0)}
    aria-valuenow={Math.round(shown)} aria-valuetext={`${clock(shown)} of ${clock(length ?? 0)}`} aria-disabled={!length}
    onPointerDown={down} onPointerUp={up} onPointerCancel={() => { set_drag(null); on_drag(false); }}
    onPointerMove={event => { if (length) set_hover(at(event)); if (drag !== null) set_drag(at(event)); }}
    onPointerLeave={() => set_hover(null)} data-dragging={drag !== null || undefined}>
    <div className="seek-track">
      {length && buffered.map(range => <span key={range.start} className="seek-buffered" style={{ left: share(range.start, length), width: share(range.end - range.start, length) }} />)}
      {length && hover !== null && hover > shown && <span className="seek-hover" style={{ left: share(shown, length), width: share(hover - shown, length) }} />}
      {length && <span className="seek-played" style={{ width: share(shown, length) }} />}
    </div>
    {length && <span className="seek-thumb" style={{ left: share(shown, length) }} />}
    {length && hover !== null && <span className="seek-tooltip" style={{ left: share(hover, length) }}>{clock(hover)}</span>}
  </div>;
}
