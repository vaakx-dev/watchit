import { useState, type FormEvent } from 'react';
import { AdminSetting } from './admin_setting';
import { create_profile, update_profile } from './api';
import { AvatarSettings } from './avatar_settings';
import { PinSettings } from './pin_settings';
import { ProfileDelete } from './profile_delete';
import { PROFILE_NAME_LIMIT, type Profile } from './types';
import { use_action } from './use_action';

type Props = { profile?: Profile; viewer: Profile | null; profiles: Profile[]; on_close: () => void; on_changed: () => void };

export function ProfileForm({ profile, viewer, profiles, on_close, on_changed }: Props) {
  const [name, set_name] = useState(profile?.name ?? '');
  const action = use_action();

  function save(event: FormEvent) {
    event.preventDefault();
    void action.run(() => profile ? update_profile(profile.id, { name }) : create_profile(name), () => {
      on_changed();
      on_close();
    });
  }

  return <div className="profile-form">
    <form onSubmit={save} aria-labelledby="profile-form-title">
      <h1 id="profile-form-title">{profile ? 'Edit profile' : 'Add profile'}</h1>
      <fieldset disabled={action.pending}>
        {profile && <AvatarSettings profile={profile} on_changed={on_changed} />}
        <div className="profile-name-field">
          <label htmlFor="profile-name">Name</label>
          <input id="profile-name" value={name} maxLength={PROFILE_NAME_LIMIT} required autoComplete="off" autoFocus={!profile}
            aria-invalid={action.error ? true : undefined} aria-describedby="profile-form-error"
            onChange={event => { set_name(event.target.value); action.set_error(''); }} />
        </div>
        <p id="profile-form-error" className="profile-error" role="alert">{action.error}</p>
        <div className="profile-actions">
          <button className="button primary" type="submit" disabled={!name.trim() || name === profile?.name}>{profile ? 'Save name' : 'Add profile'}</button>
          <button className="button ghost" type="button" onClick={on_close}>{profile ? 'Back' : 'Cancel'}</button>
        </div>
      </fieldset>
    </form>
    {profile && viewer && <PinSettings profile={profile} own={profile.id === viewer.id} on_changed={on_changed} />}
    {profile && viewer?.is_admin && <AdminSetting profile={profile} profiles={profiles} on_changed={on_changed} />}
    {profile && viewer?.is_admin && <ProfileDelete profile={profile} profiles={profiles} viewer={viewer}
      on_deleted={() => { on_changed(); on_close(); }} />}
  </div>;
}
