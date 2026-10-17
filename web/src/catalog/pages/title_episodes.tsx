import { SectionHeader } from '../../ui/section_header';
import { EpisodePages } from '../components/episode_pages';
import { SeasonPicker } from '../components/season_picker';
import { EpisodeSkeleton } from '../components/skeleton';
import { CatalogStatus } from '../components/status';
import { season_label, watched_summary } from '../episodes';
import type { SeasonNavigation } from '../use_season_navigation';
import { DownloadSeasonButton } from '../../downloads/actions/download_season_button';
import { RatingControl } from '../../library/components/rating';
import { SeasonWatchedButton } from '../../library/components/season_watched';
import type { Library } from '../../library/use_library';
import type { EpisodeNavigation, Title } from '../types';
import { EpisodeRow } from './title_episode_row';

function SeasonBar({ series, navigation, episodes, library }: { series: Title; navigation: EpisodeNavigation; episodes: SeasonNavigation; library: Library }) {
  const { season } = episodes;
  const summary = watched_summary(navigation, library.entries);
  return <div className="season-bar">
    <SeasonPicker seasons={navigation.seasons} value={season} on_change={episodes.select_season} />
    {summary && navigation.season === season && <span className="season-summary">{summary}</span>}
    {navigation.season === season && <SeasonWatchedButton series_id={series.id} navigation={navigation} library={library} />}
    {navigation.season === season && navigation.items.length > 0 && <DownloadSeasonButton series_id={series.id} season={season} />}
    <div className="season-rating">
      <span>{season_label(season)} rating</span>
      <RatingControl key={season} title={`${series.title} ${season_label(season)}`} value={library.seasons[series.id]?.[season] ?? null}
        disabled={!library.ready} on_change={rating => library.update_season(series.id, season, rating)} />
    </div>
  </div>;
}

function Rows({ navigation, up_next, library }: { navigation: EpisodeNavigation; up_next: string | undefined; library: Library }) {
  if (!navigation.items.length) return <p className="episodes-note">This season has no episodes yet.</p>;
  return <ol className="episode-rows">
    {navigation.items.map(episode => <EpisodeRow key={episode.id} episode={episode} up_next={episode.id === up_next} library={library} />)}
  </ol>;
}

function Body({ up_next, episodes, library }: { up_next: string | undefined; episodes: SeasonNavigation; library: Library }) {
  const { navigation, loading, failure, retry } = episodes;
  if (loading) return <EpisodeSkeleton />;
  if (failure) return <CatalogStatus error={failure} retry={retry} />;
  if (!navigation) return <p className="episodes-note">Episodes for this series haven't been imported yet.</p>;
  return <><Rows navigation={navigation} up_next={up_next} library={library} /><EpisodePages navigation={navigation} select_page={episodes.select_page} /></>;
}

export function TitleEpisodes({ series, up_next, episodes, library }: { series: Title; up_next: string | undefined; episodes: SeasonNavigation; library: Library }) {
  return <section className="title-episodes" id="episodes" aria-labelledby="episodes-heading" tabIndex={-1}>
    <SectionHeader id="episodes-heading" title="Episodes" />
    {episodes.navigation && <SeasonBar series={series} navigation={episodes.navigation} episodes={episodes} library={library} />}
    <Body up_next={up_next} episodes={episodes} library={library} />
  </section>;
}
