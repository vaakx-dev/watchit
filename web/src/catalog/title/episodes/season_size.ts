import type { SeasonNavigation } from '../../use_season_navigation';

export function season_size({ navigation, season }: SeasonNavigation) {
  if (!navigation || navigation.season !== season || navigation.page > 1 || navigation.has_next) return null;
  return navigation.items.length;
}
