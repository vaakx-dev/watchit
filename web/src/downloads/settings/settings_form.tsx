import { useState, type FormEvent } from 'react';
import { read_settings, save_settings } from '../../torrents/api';
import type { TorrentSettings } from '../../torrents/types';
import { field_error, NUMBER_FIELDS, to_settings, to_values, type Values } from './fields';

export function SettingsForm({ initial }: { initial: TorrentSettings }) {
  const [values, set_values] = useState(() => to_values(initial));
  const [touched, set_touched] = useState(false);
  const [pending, set_pending] = useState(false);
  const [saved, set_saved] = useState(false);
  const [failure, set_failure] = useState('');
  const errors = Object.fromEntries(NUMBER_FIELDS.map(field => [field.key, field_error(field, values[field.key])]));
  const folder_error = values.download_dir.trim() ? '' : 'Enter a folder.';
  const invalid = Boolean(folder_error) || NUMBER_FIELDS.some(field => errors[field.key]);

  async function save(event: FormEvent) {
    event.preventDefault();
    set_touched(true);
    if (invalid) return;
    set_pending(true);
    set_saved(false);
    set_failure('');
    try {
      const settings = { ...await read_settings(), ...to_settings(values) };
      const next = await save_settings(settings);
      set_values(to_values(next ?? settings));
      set_saved(true);
    } catch (cause) {
      set_failure(cause instanceof Error ? cause.message : 'Could not save. Check your connection and try again.');
    } finally {
      set_pending(false);
    }
  }

  function change(key: keyof Values, value: string) {
    set_values(current => ({ ...current, [key]: value }));
    set_saved(false);
    set_failure('');
  }

  const hint = (id: string, error: string, text: string) => <p id={id} className={touched && error ? 'cache-hint invalid' : 'cache-hint'}>{touched && error ? error : text}</p>;

  return <form className="cache-form" onSubmit={save} noValidate>
    <fieldset disabled={pending}>
      <legend className="sr-only">Torrent settings</legend>
      <div className="cache-field folder-field">
        <label htmlFor="download_dir">Download folder</label>
        <div className="cache-input"><input id="download_dir" value={values.download_dir} spellCheck={false} aria-describedby="download_dir-hint"
          aria-invalid={touched && folder_error ? true : undefined} onChange={event => change('download_dir', event.target.value)} /></div>
        {hint('download_dir-hint', folder_error, 'A folder on the computer running the server.')}
      </div>
      {NUMBER_FIELDS.map(field => <div className="cache-field" key={field.key}>
        <label htmlFor={field.key}>{field.label}</label>
        <div className="cache-input">
          <input id={field.key} inputMode="decimal" value={values[field.key]} placeholder={field.optional ? 'No limit' : undefined}
            aria-invalid={touched && errors[field.key] ? true : undefined} aria-describedby={`${field.key}-hint`}
            onChange={event => change(field.key, event.target.value)} />
          <span>{field.unit}</span>
        </div>
        {hint(`${field.key}-hint`, errors[field.key] ?? '', field.hint)}
      </div>)}
    </fieldset>
    <div className="cache-actions">
      <button className="button primary" type="submit" disabled={pending}>{pending ? 'Saving...' : 'Save changes'}</button>
      {saved && <p role="status" className="cache-saved">Saved.</p>}
      {failure && <p role="alert" className="cache-failed">{failure}</p>}
    </div>
  </form>;
}
