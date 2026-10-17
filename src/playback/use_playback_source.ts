import { useState } from 'react';
import { request } from '../catalog/client';
import type { PlaybackPreference } from '../library/types';
import { pick_provider, type Provider } from './providers';

export function use_playback_source(title_id: string, sources: readonly Provider[], remembered: string | null) {
  const [chosen, set_chosen] = useState<string | null>(null);
  const [error, set_error] = useState<string | null>(null);

  function choose(source: string) {
    set_chosen(source);
    set_error(null);
    request<PlaybackPreference>(`/api/library/${encodeURIComponent(title_id)}/playback`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ source }),
    }).catch((cause: unknown) => set_error(cause instanceof Error ? cause.message : 'The server did not respond.'));
  }

  return { provider: pick_provider(sources, chosen ?? remembered), choose, error };
}
