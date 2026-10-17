import { send } from '../../catalog/client';
import type { ClientProfile } from '../engine/client_profile';
import type { FileSource, PlaybackSession, SessionTracks } from './types';

export function open_session(title_id: string, source: FileSource, client: ClientProfile, start_seconds: number, tracks: SessionTracks, signal: AbortSignal) {
  return send<PlaybackSession>('/api/playback/sessions', 'POST', { title_id, source, client, start_seconds, ...tracks }, { signal });
}

export function close_session(id: string) {
  void send<unknown>(`/api/playback/sessions/${encodeURIComponent(id)}`, 'DELETE', undefined, { keepalive: true }).catch(() => undefined);
}
