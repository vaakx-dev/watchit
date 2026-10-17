import { useState } from 'react';
import { clock } from './clock';

const REMAINING_KEY = 'watchit:remaining-time';

export function TimeDisplay({ time, duration }: { time: number; duration: number | null }) {
  const [remaining, set_remaining] = useState(() => localStorage.getItem(REMAINING_KEY) === 'true');

  function toggle() {
    localStorage.setItem(REMAINING_KEY, String(!remaining));
    set_remaining(!remaining);
  }

  return <button type="button" className="time-display" onClick={toggle} disabled={!duration}
    aria-label={remaining ? 'Showing time left. Show elapsed time' : 'Showing elapsed time. Show time left'}>
    <span className="time-current">{duration && remaining ? `-${clock(duration - time)}` : clock(time)}</span>
    <span className="time-separator"> / </span>
    <span>{duration ? clock(duration) : '--:--'}</span>
  </button>;
}
