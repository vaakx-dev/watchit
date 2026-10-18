import type { TitleResult } from '../types';
import { DownloadTitleButton } from '../../downloads/actions/download_title_button';
import type { Library } from '../../library/use_library';
import { PlayButton } from './play_button';
import { SeriesPage } from './series_page';
import { TitleInfo } from './title_info';
import { TitleRelated } from './title_related';

export function TitlePage({ result, library }: { result: TitleResult; library: Library }) {
  const { title, resume } = result;
  if (title.kind === 'series') return <SeriesPage result={result} library={library} />;

  return <>
    <TitleInfo title={title} seasons={0} library={library}
      play={<PlayButton href={`#/watch/${title.id}`} label="Play" resume={resume} />}
      download={<DownloadTitleButton title={title} />} />
    <div className="page-gutter title-sections">
      <TitleRelated id={title.id} library={library} />
    </div>
  </>;
}

export function TitleSkeleton() {
  return <section className="title-head" role="status" aria-label="Loading title">
    <div className="title-backdrop skeleton-block" aria-hidden="true" />
    <div className="title-body" aria-hidden="true">
      <div className="skeleton-heading"><span className="skeleton-line" /></div>
      <span className="skeleton-line skeleton-metadata" />
      <div className="title-buttons"><span className="skeleton-block skeleton-button" /><span className="skeleton-block skeleton-button" /></div>
      <div className="skeleton-synopsis"><span className="skeleton-line" /><span className="skeleton-line" /></div>
    </div>
  </section>;
}
