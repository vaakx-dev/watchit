import { season_label } from '../../catalog/episodes';
import type { EpisodeNavigation } from '../../catalog/types';
import type { Library } from '../use_library';
import { StatusEye } from './eye';

export function season_watched(series_id: string, navigation: EpisodeNavigation, library: Library) {
  const { season } = navigation;
  const whole_season = navigation.page === 1 && !navigation.has_next;
  const watched = whole_season && navigation.items.every(item => library.entries[item.id]?.status === 'watched');

  function toggle() {
    if (watched && !window.confirm(`Mark every episode of ${season_label(season)} unwatched?`)) return;
    void library.mark_season_watched(series_id, season, navigation.items.map(item => item.id), !watched);
  }

  return { label: watched ? 'Mark season unwatched' : 'Mark season watched', toggle };
}

export function SeasonWatchedButton({ series_id, navigation, library }: { series_id: string; navigation: EpisodeNavigation; library: Library }) {
  if (!navigation.items.length) return null;
  const { label, toggle } = season_watched(series_id, navigation, library);

  return <button type="button" className="button ghost small season-watched" disabled={!library.ready} onClick={toggle}>
    <StatusEye status="watched" />{label}
  </button>;
}
