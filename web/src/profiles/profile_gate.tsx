import { App } from '../app';
import { use_resource } from '../catalog/api';
import { CatalogStatus } from '../catalog/components/status';
import { Brand } from '../shell/brand';
import { framed } from '../title_bar/frame';
import { WindowStrip } from '../title_bar/window_strip';
import { ProfilePicker } from './profile_picker';
import type { Profile, SessionState } from './types';

export function ProfileGate() {
  const profiles = use_resource<Profile[]>('/api/profiles', { cache: false });
  const session = use_resource<SessionState>('/api/session', { cache: false });
  const failed = [profiles.resource, session.resource].find(resource => resource.status === 'error');

  function refresh() {
    profiles.retry();
    session.retry();
  }

  if (profiles.resource.status === 'ready' && session.resource.status === 'ready' && session.resource.data.profile) {
    return <App profile={session.resource.data.profile} profiles={profiles.resource.data} on_profiles_changed={refresh} />;
  }
  return <main className="profile-gate page-gutter">
    {framed && <WindowStrip />}
    <Brand />
    {profiles.resource.status === 'ready' && session.resource.status === 'ready'
      ? <ProfilePicker profiles={profiles.resource.data} current={null} on_changed={refresh} />
      : <CatalogStatus message="Loading profiles." error={failed?.status === 'error' ? failed.error : undefined} retry={refresh} />}
  </main>;
}
