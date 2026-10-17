import { useState } from 'react';
import { Icon } from '../ui/icon';
import { sign_in, sign_out } from './api';
import { ProfileAvatar } from './avatar';
import { PinPad } from './pin_pad';
import { ProfileForm } from './profile_form';
import { ProfileList } from './profile_list';
import { end_session, start_session } from './session';
import type { Profile } from './types';
import { use_action } from './use_action';

type Props = { profiles: Profile[]; current: Profile | null; on_changed: () => void };
type Panel = { view: 'tiles' } | { view: 'manage' } | { view: 'pin'; id: number } | { view: 'edit'; id: number | null };

const TILES: Panel = { view: 'tiles' };

function tile_label(profile: Profile, current: Profile | null): string | undefined {
  if (profile.id === current?.id) return `${profile.name}, signed in`;
  return profile.has_pin ? `${profile.name}, PIN required` : undefined;
}

export function ProfilePicker({ profiles, current, on_changed }: Props) {
  const [panel, set_panel] = useState<Panel>(TILES);
  const action = use_action();
  const target = 'id' in panel && panel.id !== null ? profiles.find(profile => profile.id === panel.id) : undefined;
  const home: Panel = current?.is_admin ? { view: 'manage' } : TILES;

  if (panel.view === 'pin' && target) return <PinPad profile={target} on_cancel={() => set_panel(TILES)} />;
  if (panel.view === 'edit' && (panel.id === null || target)) {
    return <ProfileForm key={panel.id ?? 'new'} profile={target} viewer={current} profiles={profiles}
      on_close={() => set_panel(home)} on_changed={on_changed} />;
  }
  if (panel.view === 'manage' && current) {
    return <ProfileList profiles={profiles} viewer={current} on_edit={id => set_panel({ view: 'edit', id })}
      on_add={() => set_panel({ view: 'edit', id: null })} on_done={() => set_panel(TILES)} />;
  }

  function pick(profile: Profile) {
    if (profile.id === current?.id) window.location.hash = '#/';
    else if (profile.has_pin) set_panel({ view: 'pin', id: profile.id });
    else void action.run(() => sign_in(profile.id), start_session);
  }

  return <section className="profiles" aria-labelledby="profiles-title">
    <h1 id="profiles-title">Who’s watching?</h1>
    <ul className="profile-tiles">
      {profiles.map(profile => <li key={profile.id}>
        <button type="button" className="profile-tile" disabled={action.pending} onClick={() => pick(profile)}
          aria-label={tile_label(profile, current)} aria-current={profile.id === current?.id ? 'true' : undefined}>
          <ProfileAvatar profile={profile} />
          {profile.id === current?.id && <span className="profile-badge-corner"><Icon name="check" /></span>}
          {profile.id !== current?.id && profile.has_pin && <span className="profile-badge-corner locked"><Icon name="lock" /></span>}
          <span className="profile-label">{profile.name}</span>
        </button>
      </li>)}
      {(current?.is_admin || !profiles.length) && <li>
        <button type="button" className="profile-tile" onClick={() => set_panel({ view: 'edit', id: null })}>
          <span className="profile-avatar"><Icon name="plus" /></span>
          <span className="profile-label">Add profile</span>
        </button>
      </li>}
    </ul>
    <p className="profile-error" role="alert">{action.error}</p>
    {current && <div className="profile-actions">
      <button type="button" className="button secondary" onClick={() => set_panel(current.is_admin ? { view: 'manage' } : { view: 'edit', id: current.id })}>
        {current.is_admin ? 'Manage profiles' : 'Edit profile'}
      </button>
      <button type="button" className="button ghost" disabled={action.pending} onClick={() => void action.run(sign_out, end_session)}>Sign out</button>
    </div>}
  </section>;
}
