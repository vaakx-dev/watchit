import type { ReactNode } from 'react';
import { Heading } from '../components/heading';
import type { Title } from '../types';
import type { Library } from '../../library/use_library';
import { TitleBackdrop } from './title_backdrop';
import { TitleCredits } from './title_credits';
import { TitleIcons } from './title_icons';
import { TitleMeta } from './title_meta';
import { TitleSynopsis } from './title_synopsis';

export function TitleInfo({ title, seasons, library, play, download }: {
  title: Title;
  seasons: number;
  library: Library;
  play: ReactNode;
  download: ReactNode;
}) {
  return <section className="title-head" aria-labelledby="featured-title">
    <TitleBackdrop title={title} />
    <div className="title-body">
      <Heading title={title.title} />
      <TitleMeta title={title} seasons={seasons} />
      <div className="title-buttons">{play}<div className="title-download">{download}</div></div>
      {title.synopsis && <TitleSynopsis key={title.id} text={title.synopsis} />}
      <TitleCredits title={title} />
      <TitleIcons title={title} library={library} />
    </div>
  </section>;
}
