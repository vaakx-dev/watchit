import { useState, type FormEvent } from 'react';
import { request } from '../catalog/api';
import { fields, field_error } from './fields';
import type { CacheSettings, CacheStatus } from './types';

type Values = Record<keyof CacheSettings, string>;

function to_values(settings: CacheSettings): Values {
  return Object.fromEntries(fields.map(field => [field.key, String(settings[field.key])])) as Values;
}

export function CacheForm({ status, on_saved }: { status: CacheStatus; on_saved: (status: CacheStatus) => void }) {
  const [values, set_values] = useState(() => to_values(status.settings));
  const [touched, set_touched] = useState<Partial<Record<keyof CacheSettings, boolean>>>({});
  const [pending, set_pending] = useState(false);
  const [saved, set_saved] = useState(false);
  const [failure, set_failure] = useState('');
  const errors = Object.fromEntries(fields.map(field => [field.key, field_error(field, values[field.key])]));
  const invalid = fields.some(field => errors[field.key]);

  async function save(event: FormEvent) {
    event.preventDefault();
    set_touched(Object.fromEntries(fields.map(field => [field.key, true])));
    if (invalid) return;
    set_pending(true);
    set_saved(false);
    set_failure('');
    const settings = Object.fromEntries(fields.map(field => [field.key, Number(values[field.key])]));
    try {
      const next = await request<CacheStatus>('/api/cache', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(settings) });
      on_saved(next);
      set_values(to_values(next.settings));
      set_saved(true);
    } catch (cause) {
      set_failure(cause instanceof Error ? cause.message : 'Could not save. Check your connection and try again.');
    } finally {
      set_pending(false);
    }
  }

  function change(key: keyof CacheSettings, value: string) {
    set_values(current => ({ ...current, [key]: value }));
    set_saved(false);
    set_failure('');
  }

  return <form className="cache-form" onSubmit={save} noValidate>
    <fieldset disabled={pending}>
      <legend className="sr-only">Cache durations and storage</legend>
      {fields.map(field => {
        const error = touched[field.key] ? errors[field.key] : '';
        return <div className="cache-field" key={field.key}>
          <label htmlFor={field.key}>{field.label}</label>
          <div className="cache-input">
            <input id={field.key} inputMode="decimal" value={values[field.key]} aria-invalid={error ? true : undefined}
              aria-describedby={`${field.key}-hint`}
              onChange={event => change(field.key, event.target.value)}
              onBlur={() => set_touched(current => ({ ...current, [field.key]: true }))} />
            <span>{field.unit}</span>
          </div>
          <p id={`${field.key}-hint`} className={error ? 'cache-hint invalid' : 'cache-hint'}>{error || field.hint}</p>
        </div>;
      })}
    </fieldset>
    <div className="cache-actions">
      <button className="button primary" type="submit" disabled={pending}>{pending ? 'Saving...' : 'Save changes'}</button>
      {saved && <p role="status" className="cache-saved">Saved.</p>}
      {failure && <p role="alert" className="cache-failed">{failure}</p>}
    </div>
  </form>;
}
