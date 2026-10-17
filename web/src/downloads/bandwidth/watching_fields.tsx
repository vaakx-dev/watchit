import { MonitorPlay } from 'lucide-react';
import type { WhileWatching } from '../../torrents/types';
import { Choices } from '../../ui/choices';
import type { Errors, Values } from '../settings/fields';
import { NumberRow } from '../settings/number_row';
import { BACKGROUND_FIELD } from './fields';

const HINTS: Record<WhileWatching, string> = {
  pause: 'Other downloads pause while a video plays and resume 15 seconds after it stops.',
  throttle: 'Other downloads keep going at a lower speed while a video plays.',
  none: 'Other downloads keep their normal speed while a video plays.',
};

const CHOICES: { value: WhileWatching; label: string }[] = [
  { value: 'pause', label: 'Pause' },
  { value: 'throttle', label: 'Slow down' },
  { value: 'none', label: 'Keep going' },
];

export function WatchingFields({ values, errors, while_watching, touched, on_value, on_change }: {
  values: Values;
  errors: Errors;
  while_watching: WhileWatching;
  touched: boolean;
  on_value: (key: keyof Values, value: string) => void;
  on_change: (while_watching: WhileWatching) => void;
}) {
  return <fieldset className="speed-fieldset">
    <legend><MonitorPlay />While you watch</legend>
    <div className="cache-field">
      <span className="speed-label">Other downloads</span>
      <Choices label="Other downloads while you watch" look="segmented" options={CHOICES} value={while_watching} on_change={on_change} />
      <p className="cache-hint">{HINTS[while_watching]}</p>
    </div>
    {while_watching === 'throttle' && <NumberRow field={BACKGROUND_FIELD} value={values[BACKGROUND_FIELD.key]} error={errors[BACKGROUND_FIELD.key]}
      touched={touched} on_change={value => on_value(BACKGROUND_FIELD.key, value)} />}
  </fieldset>;
}
