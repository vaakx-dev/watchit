import { Lock, Plus } from 'lucide-react';
import { ProfileAvatar } from './avatar';
import type { Profile } from './types';

type Props = { profiles: Profile[]; viewer: Profile; on_edit: (id: number) => void; on_add: () => void; on_done: () => void };

export function ProfileList({ profiles, viewer, on_edit, on_add, on_done }: Props) {
  return <section className="profile-manage" aria-labelledby="manage-title">
    <h1 id="manage-title">Manage profiles</h1>
    <ul className="profile-rows">
      {profiles.map(profile => <li key={profile.id} className="profile-row">
        <ProfileAvatar profile={profile} />
        <div className="profile-row-text">
          <span className="profile-row-name">{profile.name}{profile.id === viewer.id && <span className="profile-you">You</span>}</span>
          <span className="profile-row-meta">
            {profile.is_admin && <span className="profile-badge">Admin</span>}
            {profile.has_pin ? <span className="profile-pin-on"><Lock />PIN</span> : <span>No PIN</span>}
          </span>
        </div>
        <button className="button secondary small" type="button" aria-label={`Edit ${profile.name}`} onClick={() => on_edit(profile.id)}>Edit</button>
      </li>)}
    </ul>
    <div className="profile-actions">
      <button className="button primary" type="button" onClick={on_add}><Plus />Add profile</button>
      <button className="button ghost" type="button" onClick={on_done}>Done</button>
    </div>
  </section>;
}
