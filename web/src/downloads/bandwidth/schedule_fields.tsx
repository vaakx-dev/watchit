import type { SpeedSchedule } from '../../torrents/types';
import { FieldHint } from '../settings/field_hint';
import { schedule_error } from './fields';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function toggled(days: number[], day: number) {
  return days.includes(day) ? days.filter(item => item !== day) : [...days, day].sort();
}

export function ScheduleFields({ schedule, touched, on_change }: {
  schedule: SpeedSchedule;
  touched: boolean;
  on_change: (schedule: SpeedSchedule) => void;
}) {
  const change = (next: Partial<SpeedSchedule>) => on_change({ ...schedule, ...next });
  return <>
    <label className="speed-check">
      <input type="checkbox" checked={schedule.enabled} onChange={event => change({ enabled: event.target.checked })} />
      Switch to alternative speed on a schedule
    </label>
    {schedule.enabled && <div className="cache-field speed-schedule">
      <span className="speed-schedule-times">
        <label htmlFor="schedule_from">From</label>
        <input id="schedule_from" type="time" value={schedule.from} onChange={event => change({ from: event.target.value })} />
        <label htmlFor="schedule_to">to</label>
        <input id="schedule_to" type="time" value={schedule.to} onChange={event => change({ to: event.target.value })} />
      </span>
      <div className="choices chips speed-days" role="group" aria-label="Days">
        {DAYS.map((day, index) => <button type="button" key={day} aria-label={day} title={day} aria-pressed={schedule.days.includes(index)}
          onClick={() => change({ days: toggled(schedule.days, index) })}>{day.slice(0, 3)}</button>)}
      </div>
      <FieldHint id="schedule-hint" error={schedule_error(schedule)} touched={touched}
        text="Turns on at the start time and off at the end. You can still switch it yourself in between." />
    </div>}
  </>;
}
