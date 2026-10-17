import { useState } from 'react';
import type { TimeRange } from '../engine/types';
import { clock } from './clock';
import { SeekBar } from './seek_bar';

const REMAINING_KEY = 'watchit:remaining-time';

type Props = { time: number; duration: number | null; buffered: TimeRange[]; on_seek: (seconds: number) => void; on_drag: (dragging: boolean) => void };

export function Timeline({ time, duration, buffered, on_seek, on_drag }: Props) {
  const [remaining, set_remaining] = useState(() => localStorage.getItem(REMAINING_KEY) === 'true');

  function toggle() {
    localStorage.setItem(REMAINING_KEY, String(!remaining));
    set_remaining(!remaining);
  }

  return <div className="timeline">
    <span className="timeline-time">{clock(time)}</span>
    <SeekBar time={time} duration={duration} buffered={buffered} on_seek={on_seek} on_drag={on_drag} />
    <button type="button" className="timeline-time" onClick={toggle} disabled={!duration}
      aria-label={remaining ? 'Showing time left. Show duration' : 'Showing duration. Show time left'}>
      {duration ? remaining ? `-${clock(duration - time)}` : clock(duration) : '--:--'}
    </button>
  </div>;
}
