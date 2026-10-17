import type { ChangeEvent } from 'react';
import { remove_avatar, shuffle_avatar, upload_avatar } from './api';
import { ProfileAvatar } from './avatar';
import type { Profile } from './types';
import { use_action } from './use_action';

export function AvatarSettings({ profile, on_changed }: { profile: Profile; on_changed: () => void }) {
  const action = use_action();

  function upload(event: ChangeEvent<HTMLInputElement>) {
    const image = event.target.files?.[0];
    event.target.value = '';
    if (image) void action.run(() => upload_avatar(profile.id, image), on_changed);
  }

  return <section className="profile-picture" aria-label="Picture">
    <ProfileAvatar profile={profile} />
    <fieldset disabled={action.pending}>
      <div className="profile-actions">
        <label className="button secondary small">
          Upload photo
          <input className="sr-only" type="file" accept="image/*" onChange={upload} />
        </label>
        {profile.avatar.kind === 'eyes'
          ? <button className="button ghost small" type="button" onClick={() => void action.run(() => shuffle_avatar(profile.id), on_changed)}>Shuffle</button>
          : <button className="button ghost small" type="button" onClick={() => void action.run(() => remove_avatar(profile.id), on_changed)}>Remove photo</button>}
      </div>
      <p className="profile-error" role="alert">{action.error}</p>
    </fieldset>
  </section>;
}
