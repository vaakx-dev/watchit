import { remember, responses } from '../../cache/responses';
import { send } from '../../catalog/client';
import type { SavedPosition, TitleResult } from '../../catalog/types';
import type { ProgressSaved } from '../../generated/library/ProgressSaved';

export async function save_position(title_id: string, position: SavedPosition) {
  const saved = await send<ProgressSaved>(`/api/progress/${encodeURIComponent(title_id)}`, 'PUT', position, { keepalive: true });
  const title_url = `/api/titles/${encodeURIComponent(title_id)}`;
  const cached = responses.get<TitleResult>(title_url);
  if (cached) remember(title_url, { ...cached, resume: saved.resume });
  return saved;
}
