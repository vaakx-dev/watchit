import { useState } from 'react';
import { Lock, LogOut, Plus, Users } from 'lucide-react';
import { sign_out } from '../../profiles/api';
import { ProfileAvatar } from '../../profiles/avatar';
import { ProfileForm } from '../../profiles/profile_form';
import { end_session } from '../../profiles/session';
import type { Profile } from '../../profiles/types';
import { use_action } from '../../profiles/use_action';
import { SectionFrame } from '../controls/section_frame';

type Props = { profile: Profile; profiles: Profile[]; on_changed: () => void };

export function ProfilesSection({ profile, profiles, on_changed }: Props) {
  const [editing, set_editing] = useState<number | 'new' | null>(null);
  const action = use_action();
  const shown = profile.is_admin ? profiles : profiles.filter(item => item.id === profile.id);
  const target = profiles.find(item => item.id === editing);

  if (editing !== null && (editing === 'new' || target)) {
    return <SectionFrame title="Profiles">
      <ProfileForm key={editing} profile={target} viewer={profile} profiles={profiles} on_close={() => set_editing(null)} on_changed={on_changed} />
    </SectionFrame>;
  }

  return <SectionFrame title="Profiles" intro="Each profile has its own library, ratings and history.">
    <ul className="profile-rows">
      {shown.map(item => <li key={item.id} className="profile-row">
        <ProfileAvatar profile={item} />
        <div className="profile-row-text">
          <span className="profile-row-name">{item.name}{item.id === profile.id && <span className="profile-you">You</span>}</span>
          <span className="profile-row-meta">
            {item.is_admin && <span className="profile-badge">Admin</span>}
            {item.has_pin ? <span className="profile-pin-on"><Lock />PIN</span> : <span>No PIN</span>}
          </span>
        </div>
        <button className="button secondary small" type="button" aria-label={`Edit ${item.name}`} onClick={() => set_editing(item.id)}>Edit</button>
      </li>)}
    </ul>
    <p className="profile-error" role="alert">{action.error}</p>
    <div className="profile-actions">
      {profile.is_admin && <button className="button primary" type="button" onClick={() => set_editing('new')}><Plus />Add profile</button>}
      <a className="button secondary" href="#/profiles"><Users />Switch profile</a>
      <button className="button ghost" type="button" disabled={action.pending} onClick={() => void action.run(sign_out, end_session)}><LogOut />Sign out</button>
    </div>
  </SectionFrame>;
}
