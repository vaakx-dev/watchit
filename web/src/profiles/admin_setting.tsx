import { update_profile } from './api';
import { is_only_admin } from './rules';
import type { Profile } from './types';
import { use_action } from './use_action';

type Props = { profile: Profile; profiles: Profile[]; on_changed: () => void };

export function AdminSetting({ profile, profiles, on_changed }: Props) {
  const action = use_action();
  const only_admin = is_only_admin(profile, profiles);

  return <section className="profile-section" aria-labelledby="admin-heading">
    <h2 id="admin-heading">Admin</h2>
    <p className="profile-note">{profile.is_admin ? 'Can add, rename and delete profiles and reset their PINs.' : 'Can change only their own name and PIN.'}</p>
    <div className="profile-actions">
      <button className="button secondary" type="button" disabled={action.pending || only_admin}
        onClick={() => void action.run(() => update_profile(profile.id, { is_admin: !profile.is_admin }), on_changed)}>
        {profile.is_admin ? 'Remove admin' : 'Make admin'}
      </button>
    </div>
    {only_admin && <p className="profile-note">This is the only admin. Make another profile an admin first.</p>}
    <p className="profile-error" role="alert">{action.error}</p>
  </section>;
}
