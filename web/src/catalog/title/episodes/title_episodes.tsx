import { EpisodePages } from '../../components/episode_pages';
import { EpisodeSkeleton } from '../../components/skeleton';
import { CatalogStatus } from '../../components/status';
import { watched_summary } from '../../episodes';
import type { EpisodeNavigation, Title } from '../../types';
import type { SeasonNavigation } from '../../use_season_navigation';
import type { SeasonDownloadState } from '../../../downloads/actions/use_season_download';
import type { SeriesProgress } from '../../../library/types';
import type { Library } from '../../../library/use_library';
import { EpisodeRow } from './episode_row';
import { SeasonMenu } from './season_menu';
import { SeasonSelect } from './season_select';

type Shared = { series: Title; progress: SeriesProgress | null; library: Library };

function Rows({ series, progress, navigation, library }: Shared & { navigation: EpisodeNavigation }) {
  if (!navigation.items.length) return <p className="episodes-note">This season has no episodes yet.</p>;
  const next = progress?.next?.id;
  return <ol className="episode-rows">
    {navigation.items.map(episode => <EpisodeRow key={episode.id} episode={episode} minutes={series.minutes} up_next={episode.id === next}
      resume={episode.id === next ? progress?.resume ?? null : null} library={library} />)}
  </ol>;
}

function Body({ episodes, ...shared }: Shared & { episodes: SeasonNavigation }) {
  const { navigation, loading, failure, retry } = episodes;
  if (loading) return <EpisodeSkeleton />;
  if (failure) return <CatalogStatus error={failure} retry={retry} />;
  if (!navigation) return <p className="episodes-note">Episodes for this series haven't been imported yet.</p>;
  return <><Rows navigation={navigation} {...shared} /><EpisodePages navigation={navigation} select_page={episodes.select_page} /></>;
}

export function TitleEpisodes({ episodes, download, ...shared }: Shared & { episodes: SeasonNavigation; download: SeasonDownloadState }) {
  const { navigation, season } = episodes;
  const summary = navigation && navigation.season === season ? watched_summary(navigation, shared.library.entries) : null;

  return <section className="title-episodes" id="episodes" aria-label="Episodes" tabIndex={-1}>
    {navigation && <div className="season-head">
      <SeasonSelect seasons={navigation.seasons} value={season} on_change={episodes.select_season} />
      {summary && <span className="season-summary">· {summary}</span>}
      <SeasonMenu series={shared.series} navigation={navigation} download={download} library={shared.library} />
    </div>}
    <Body episodes={episodes} {...shared} />
  </section>;
}
