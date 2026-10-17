import { useState, type FormEvent } from 'react';
import { read_settings, save_settings } from '../../torrents/api';
import type { TorrentSettings } from '../../torrents/types';
import { AlternativeFields } from '../bandwidth/alternative_fields';
import { schedule_error, to_speed_settings, type SpeedSettings } from '../bandwidth/fields';
import { WatchingFields } from '../bandwidth/watching_fields';
import { FolderField } from '../locations/folder_field';
import { use_admin } from '../locations/use_admin';
import { field_errors, NUMBER_FIELDS, to_settings, to_values, type Values } from './fields';
import { NumberRow } from './number_row';

export function SettingsForm({ initial }: { initial: TorrentSettings }) {
  const [values, set_values] = useState(() => to_values(initial));
  const [speed, set_speed] = useState(() => to_speed_settings(initial));
  const admin = use_admin();
  const [touched, set_touched] = useState(false);
  const [pending, set_pending] = useState(false);
  const [saved, set_saved] = useState(false);
  const [failure, set_failure] = useState('');
  const errors = field_errors(values);
  const folder_error = values.download_dir.trim() ? '' : 'Enter a folder.';
  const invalid = Boolean(folder_error) || Object.values(errors).some(Boolean) || Boolean(schedule_error(speed.schedule));

  async function save(event: FormEvent) {
    event.preventDefault();
    set_touched(true);
    if (invalid) return;
    set_pending(true);
    set_saved(false);
    set_failure('');
    try {
      const settings = { ...await read_settings(), ...to_settings(values), ...speed };
      const next = await save_settings(settings);
      set_values(to_values(next ?? settings));
      set_speed(to_speed_settings(next ?? settings));
      set_saved(true);
    } catch (cause) {
      set_failure(cause instanceof Error ? cause.message : 'Could not save. Check your connection and try again.');
    } finally {
      set_pending(false);
    }
  }

  function changed() {
    set_saved(false);
    set_failure('');
  }

  function change(key: keyof Values, value: string) {
    set_values(current => ({ ...current, [key]: value }));
    changed();
  }

  function change_speed(next: Partial<SpeedSettings>) {
    set_speed(current => ({ ...current, ...next }));
    changed();
  }

  return <form className="cache-form" onSubmit={save} noValidate>
    <fieldset disabled={pending}>
      <legend className="sr-only">Torrent settings</legend>
      <FolderField id="download_dir" label="Download folder" hint="A folder on the computer running the server." value={values.download_dir}
        invalid={touched ? folder_error : ''} admin={admin} on_change={value => change('download_dir', value)} />
      <FolderField id="movie_dir" label="Movies folder" hint="Leave empty to use the download folder." value={values.movie_dir}
        placeholder="Same as download folder" admin={admin} on_change={value => change('movie_dir', value)} />
      <FolderField id="series_dir" label="Shows folder" hint="Leave empty to use the download folder." value={values.series_dir}
        placeholder="Same as download folder" admin={admin} on_change={value => change('series_dir', value)} />
      {NUMBER_FIELDS.map(field => <NumberRow key={field.key} field={field} value={values[field.key]} error={errors[field.key]}
        touched={touched} on_change={value => change(field.key, value)} />)}
      <AlternativeFields values={values} errors={errors} schedule={speed.schedule} touched={touched}
        on_value={change} on_schedule={schedule => change_speed({ schedule })} />
      <WatchingFields values={values} errors={errors} while_watching={speed.while_watching} touched={touched}
        on_value={change} on_change={while_watching => change_speed({ while_watching })} />
    </fieldset>
    <div className="cache-actions">
      <button className="button primary" type="submit" disabled={pending}>{pending ? 'Saving...' : 'Save changes'}</button>
      {saved && <p role="status" className="cache-saved">Saved.</p>}
      {failure && <p role="alert" className="cache-failed">{failure}</p>}
    </div>
  </form>;
}
