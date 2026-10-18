import { play_label } from '../episodes';
import type { TitleResult } from '../types';
import { DownloadSeasonButton } from '../../downloads/actions/download_season_button';
import { use_season_download } from '../../downloads/actions/use_season_download';
import type { Library } from '../../library/use_library';
import { season_size } from './episodes/season_size';
import { TitleEpisodes } from './episodes/title_episodes';
import { use_series_episodes } from './episodes/use_series_episodes';
import { PlayButton } from './play_button';
import { TitleInfo } from './title_info';
import { TitleRelated } from './title_related';

function show_episodes() {
  const episodes = document.getElementById('episodes');
  episodes?.scrollIntoView();
  episodes?.focus({ preventScroll: true });
}

export function SeriesPage({ result, library }: { result: TitleResult; library: Library }) {
  const { title, progress } = result;
  const episodes = use_series_episodes(title.id, progress);
  const download = use_season_download(title, episodes.season);
  const seasons = episodes.navigation?.seasons.filter(season => season > 0).length ?? 0;
  const next = progress?.next;
  const play = next
    ? <PlayButton href={`#/watch/${next.id}`} label={play_label(next)} resume={progress.resume} />
    : <button type="button" className="button primary wide" onClick={show_episodes}>View episodes</button>;

  return <>
    <TitleInfo title={title} seasons={seasons} library={library} play={play}
      download={episodes.navigation && <DownloadSeasonButton download={download} episodes={season_size(episodes)} />} />
    <div className="page-gutter title-sections">
      <TitleEpisodes series={title} progress={progress} episodes={episodes} download={download} library={library} />
      <TitleRelated id={title.id} library={library} />
    </div>
    {download.picker}
  </>;
}
