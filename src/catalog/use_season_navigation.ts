import { useState } from 'react';
import { awaiting_items, use_episode_navigation } from './api';
import type { EpisodeNavigation } from './types';

export function use_season_navigation(anchor_id: string | null) {
  const [selection, set_selection] = useState<{ season: number; page: number }>();
  const [shown, set_shown] = useState<EpisodeNavigation>();
  const { resource, retry } = use_episode_navigation(anchor_id, selection);
  const loaded = resource.status === 'ready' ? resource.data : undefined;
  if (loaded && loaded !== shown) set_shown(loaded);
  const navigation = loaded ?? shown;
  const season = selection?.season ?? navigation?.season ?? 1;
  const failure = resource.status === 'error' ? resource.error
    : loaded && !loaded.items.length ? loaded.imports?.error ?? null : null;

  return {
    navigation,
    season,
    loading: awaiting_items(resource),
    failure,
    retry,
    select_season: (value: number) => set_selection({ season: value, page: 1 }),
    select_page: (page: number) => set_selection({ season, page }),
  };
}

export type SeasonNavigation = ReturnType<typeof use_season_navigation>;
