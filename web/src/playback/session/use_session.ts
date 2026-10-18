import { useEffect, useState } from 'react';
import { error_message } from '../../catalog/client';
import { client_profile } from '../engine/client_profile';
import { close_session, open_session } from './api';
import type { FileSource, PlaybackSession, SessionTracks } from './types';

type Request = { start: number; tracks: SessionTracks };
type Opened = { request: Request; session: PlaybackSession | null; error: string | null };

export function use_session(title_id: string, source: FileSource | null, start: number) {
  const [request, set_request] = useState<Request>({ start, tracks: {} });
  const [opened, set_opened] = useState<Opened | null>(null);
  const source_key = source ? `${source.info_hash}/${source.file_index}` : null;

  useEffect(() => {
    if (!source) return;
    const controller = new AbortController();
    let id: string | null = null;
    client_profile()
      .then(client => open_session(title_id, source, client, request.start, request.tracks, controller.signal))
      .then(session => {
        id = session.id;
        if (controller.signal.aborted) close_session(session.id);
        else set_opened({ request, session, error: null });
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) set_opened({ request, session: null, error: error_message(cause) });
      });
    return () => {
      controller.abort();
      if (id) close_session(id);
    };
  }, [title_id, source_key, request]);

  const current = opened?.request === request ? opened : null;
  return {
    session: current?.session ?? null,
    error: current?.error ?? null,
    start: request.start,
    tracks: request.tracks,
    restart: (at: number, tracks: SessionTracks) => set_request(previous => ({ start: at, tracks: { ...previous.tracks, ...tracks } })),
  };
}
