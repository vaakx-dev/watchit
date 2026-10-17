import { Turtle } from 'lucide-react';
import type { SpeedSchedule } from '../../torrents/types';
import type { Errors, Values } from '../settings/fields';
import { NumberRow } from '../settings/number_row';
import { ALTERNATIVE_FIELDS } from './fields';
import { ScheduleFields } from './schedule_fields';

export function AlternativeFields({ values, errors, schedule, touched, on_value, on_schedule }: {
  values: Values;
  errors: Errors;
  schedule: SpeedSchedule;
  touched: boolean;
  on_value: (key: keyof Values, value: string) => void;
  on_schedule: (schedule: SpeedSchedule) => void;
}) {
  return <fieldset className="speed-fieldset">
    <legend><Turtle />Alternative speed</legend>
    {ALTERNATIVE_FIELDS.map(field => <NumberRow key={field.key} field={field} value={values[field.key]} error={errors[field.key]}
      touched={touched} on_change={value => on_value(field.key, value)} />)}
    <ScheduleFields schedule={schedule} touched={touched} on_change={on_schedule} />
  </fieldset>;
}
