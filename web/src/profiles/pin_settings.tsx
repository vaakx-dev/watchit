import { useState, type FormEvent } from 'react';
import { change_pin } from './api';
import { PIN_LENGTH, type Profile } from './types';
import { use_action } from './use_action';

type Props = { profile: Profile; own: boolean; on_changed: () => void };

function PinField({ id, label, value, on_change }: { id: string; label: string; value: string; on_change: (value: string) => void }) {
  return <div className="pin-field">
    <label htmlFor={id}>{label}</label>
    <input id={id} type="password" inputMode="numeric" pattern="[0-9]*" maxLength={PIN_LENGTH} autoComplete="off" value={value}
      onChange={event => on_change(event.target.value.replace(/\D/g, '').slice(0, PIN_LENGTH))} />
  </div>;
}

function save_label(profile: Profile, own: boolean): string {
  if (!profile.has_pin) return 'Set PIN';
  return own ? 'Change PIN' : 'Reset PIN';
}

export function PinSettings({ profile, own, on_changed }: Props) {
  const [current_pin, set_current_pin] = useState('');
  const [pin, set_pin] = useState('');
  const [saved, set_saved] = useState('');
  const action = use_action();
  const needs_current = own && profile.has_pin;
  const current_ready = !needs_current || current_pin.length === PIN_LENGTH;

  function save(next: string | null, done: string) {
    set_saved('');
    void action.run(() => change_pin(profile.id, needs_current ? { pin: next, current_pin } : { pin: next }), () => {
      set_current_pin('');
      set_pin('');
      set_saved(done);
      on_changed();
    });
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    save(pin, profile.has_pin ? 'PIN changed.' : 'PIN set.');
  }

  return <section className="profile-section" aria-labelledby="pin-heading">
    <h2 id="pin-heading">PIN</h2>
    <p className="profile-note">{profile.has_pin ? 'On. The PIN is needed to pick this profile.' : 'Off. Anyone can pick this profile.'}</p>
    <form onSubmit={submit}>
      <fieldset disabled={action.pending}>
        <div className="pin-fields">
          {needs_current && <PinField id="current-pin" label="Current PIN" value={current_pin} on_change={set_current_pin} />}
          <PinField id="new-pin" label={profile.has_pin ? 'New PIN' : `${PIN_LENGTH}-digit PIN`} value={pin} on_change={set_pin} />
        </div>
        <p className="profile-error" role="alert">{action.error}</p>
        <p className="profile-saved" role="status">{saved}</p>
        <div className="profile-actions">
          <button className="button primary" type="submit" disabled={pin.length !== PIN_LENGTH || !current_ready}>{save_label(profile, own)}</button>
          {profile.has_pin && <button className="button secondary" type="button" disabled={!current_ready}
            onClick={() => save(null, 'PIN removed.')}>Remove PIN</button>}
        </div>
      </fieldset>
    </form>
  </section>;
}
