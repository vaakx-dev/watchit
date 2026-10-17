import { send } from '../catalog/client';
import type { RemoteStatus } from './types';

export function set_tailscale_sharing(enabled: boolean): Promise<RemoteStatus> {
  return send('/api/remote/tailscale', 'PUT', { enabled });
}
