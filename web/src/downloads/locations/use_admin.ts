import { use_resource } from '../../catalog/api';
import type { SessionState } from '../../profiles/types';

export function use_admin() {
  const { resource } = use_resource<SessionState>('/api/session', { cache: false });
  return resource.status === 'ready' && resource.data.profile?.is_admin === true;
}
