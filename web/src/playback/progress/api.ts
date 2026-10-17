import { send } from '../../catalog/client';
import type { SavedPosition } from '../../generated/catalog/SavedPosition';

export type { SavedPosition };

export function save_position(title_id: string, position: SavedPosition) {
  return send<unknown>(`/api/progress/${encodeURIComponent(title_id)}`, 'PUT', position, { keepalive: true });
}
