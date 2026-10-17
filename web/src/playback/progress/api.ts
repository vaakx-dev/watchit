import { send } from '../../catalog/client';

export type SavedPosition = { position_seconds: number; duration_seconds: number };

export function save_position(title_id: string, position: SavedPosition) {
  return send<unknown>(`/api/progress/${encodeURIComponent(title_id)}`, 'PUT', position, { keepalive: true });
}
