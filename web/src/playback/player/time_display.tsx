import { clock } from './clock';
import { set_remaining_time, use_remaining_time } from './remaining_time';

export function TimeDisplay({ time, duration }: { time: number; duration: number | null }) {
  const remaining = use_remaining_time();

  return <button type="button" className="time-display" onClick={() => set_remaining_time(!remaining)} disabled={!duration}
    aria-label={remaining ? 'Showing time left. Show elapsed time' : 'Showing elapsed time. Show time left'}>
    <span className="time-current">{duration && remaining ? `-${clock(duration - time)}` : clock(time)}</span>
    <span className="time-separator"> / </span>
    <span>{duration ? clock(duration) : '--:--'}</span>
  </button>;
}
