import type { TitleResult } from '../types';
import type { Library } from '../../library/use_library';
import { TitleEpisodes } from './title_episodes';
import { TitleHero } from './title_hero';
import { TitleRelated } from './title_related';
import { use_series_episodes } from './use_series_episodes';

export function TitlePage({ result, library }: { result: TitleResult; library: Library }) {
  const { title, progress } = result;
  const series = title.kind === 'series';
  const episodes = use_series_episodes(series ? title.id : null, progress);
  const seasons = episodes.navigation?.seasons.filter(season => season > 0).length ?? 0;

  return <>
    <TitleHero title={title} progress={progress} seasons={seasons} library={library} />
    <div className="page-gutter title-sections">
      {series && <TitleEpisodes series={title} up_next={progress?.next?.id} episodes={episodes} library={library} />}
      <TitleRelated id={title.id} library={library} />
    </div>
  </>;
}

export function TitleSkeleton() {
  return <section className="title-hero" role="status" aria-label="Loading title">
    <div className="title-hero-art skeleton-block" aria-hidden="true" />
    <div className="title-hero-body" aria-hidden="true">
      <div className="title-poster skeleton-block" />
      <div className="title-copy">
        <div className="skeleton-heading"><span className="skeleton-line" /><span className="skeleton-line" /></div>
        <span className="skeleton-line skeleton-metadata" />
        <div className="skeleton-synopsis"><span className="skeleton-line" /><span className="skeleton-line" /></div>
        <div className="title-actions"><span className="skeleton-block skeleton-button" /><span className="skeleton-block skeleton-button" /></div>
      </div>
    </div>
  </section>;
}
