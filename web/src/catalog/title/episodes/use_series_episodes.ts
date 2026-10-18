import { awaiting_items, use_first_episodes } from '../../api';
import { navigation_anchor } from '../../episodes';
import { use_season_navigation, type SeasonNavigation } from '../../use_season_navigation';
import type { SeriesProgress } from '../../../library/types';

export function use_series_episodes(series_id: string | null, progress: SeriesProgress | null): SeasonNavigation {
  const known = navigation_anchor(progress, []);
  const { resource, retry } = use_first_episodes(series_id && !known ? series_id : null);
  const first = resource.status === 'ready' ? resource.data : undefined;
  const anchor = series_id ? navigation_anchor(progress, first?.items ?? []) : null;
  const seasons = use_season_navigation(anchor?.id ?? null);
  if (anchor) return seasons;
  return {
    ...seasons,
    loading: awaiting_items(resource),
    failure: resource.status === 'error' ? resource.error : first?.imports?.error ?? null,
    retry,
  };
}
