import type { SpeedSchedule } from '../../torrents/types';
import { SettingRow } from '../controls/setting_row';
import { Switch } from '../controls/switch';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function toggled(days: number[], day: number) {
  return days.includes(day) ? days.filter(item => item !== day) : [...days, day].sort();
}

export function ScheduleSetting({ schedule, on_save }: { schedule: SpeedSchedule; on_save: (schedule: SpeedSchedule) => void }) {
  const change = (next: Partial<SpeedSchedule>) => on_save({ ...schedule, ...next });
  const error = schedule.enabled && !schedule.days.length ? 'Pick at least one day.' : '';
  return <>
    <SettingRow label="On a schedule" hint="Switches on at the start time and off at the end.">
      <Switch label="Alternative speed on a schedule" checked={schedule.enabled} on_change={enabled => change({ enabled })} />
    </SettingRow>
    {schedule.enabled && <SettingRow label="When" error={error} wide>
      <div className="setting-schedule">
        <span className="setting-times">
          <input type="time" aria-label="From" value={schedule.from} onChange={event => { if (event.target.value) change({ from: event.target.value }); }} />
          <span>to</span>
          <input type="time" aria-label="To" value={schedule.to} onChange={event => { if (event.target.value) change({ to: event.target.value }); }} />
        </span>
        <span className="choices chips" role="group" aria-label="Days">
          {DAYS.map((day, index) => <button type="button" key={day} aria-label={day} title={day} aria-pressed={schedule.days.includes(index)}
            onClick={() => change({ days: toggled(schedule.days, index) })}>{day.slice(0, 3)}</button>)}
        </span>
      </div>
    </SettingRow>}
  </>;
}
