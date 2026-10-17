import { FieldHint } from './field_hint';
import type { NumberField } from './fields';

export function NumberRow({ field, value, error, touched, on_change }: {
  field: NumberField;
  value: string;
  error: string;
  touched: boolean;
  on_change: (value: string) => void;
}) {
  return <div className="cache-field">
    <label htmlFor={field.key}>{field.label}</label>
    <div className="cache-input">
      <input id={field.key} inputMode="decimal" value={value} placeholder={field.optional ? 'No limit' : undefined}
        aria-invalid={touched && error ? true : undefined} aria-describedby={`${field.key}-hint`}
        onChange={event => on_change(event.target.value)} />
      <span>{field.unit}</span>
    </div>
    <FieldHint id={`${field.key}-hint`} error={error} touched={touched} text={field.hint} />
  </div>;
}
