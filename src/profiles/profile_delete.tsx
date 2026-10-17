import { useState } from 'react';
import { delete_profile } from './api';
import { is_only_admin } from './rules';
import { end_session } from './session';
import type { Profile } from './types';
import { use_action } from './use_action';

type Props = { profile: Profile; profiles: Profile[]; viewer: Profile; on_deleted: () => void };

function blocker(profile: Profile, profiles: Profile[]): string {
  if (profiles.length === 1) return 'The last profile can’t be deleted.';
  if (is_only_admin(profile, profiles)) return 'The only admin can’t be deleted. Make another profile an admin first.';
  return '';
}

export function ProfileDelete({ profile, profiles, viewer, on_deleted }: Props) {
  const [confirming, set_confirming] = useState(false);
  const [typed, set_typed] = useState('');
  const action = use_action();
  const blocked = blocker(profile, profiles);

  function remove() {
    void action.run(() => delete_profile(profile.id, typed), () => profile.id === viewer.id ? end_session() : on_deleted());
  }

  if (!confirming) {
    return <div className="profile-delete">
      <button className="button secondary" type="button" disabled={Boolean(blocked)} onClick={() => set_confirming(true)}>Delete profile</button>
      {blocked && <p className="profile-note">{blocked}</p>}
    </div>;
  }

  return <div className="profile-delete">
    <p className="profile-note">
      Delete {profile.name}? Its statuses, ratings, rankings, history and playback choices are removed for good.
      {profile.id === viewer.id && ' You’re signed in as this profile, so this device signs out.'}
    </p>
    <div className="profile-confirm">
      <label htmlFor="profile-confirm">Type {profile.name} to confirm</label>
      <input id="profile-confirm" value={typed} autoComplete="off" autoFocus disabled={action.pending} onChange={event => set_typed(event.target.value)} />
    </div>
    <p className="profile-error" role="alert">{action.error}</p>
    <div className="profile-actions">
      <button className="button primary" type="button" disabled={action.pending || typed !== profile.name} onClick={remove}>Delete {profile.name}</button>
      <button className="button ghost" type="button" onClick={() => { set_confirming(false); set_typed(''); }}>Keep profile</button>
    </div>
  </div>;
}
