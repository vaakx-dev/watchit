import { useEffect } from 'react';
import { episode_code } from '../catalog/episodes';
import { runtime } from '../catalog/format';
import type { Title } from '../catalog/types';
import { use_season_navigation } from '../catalog/use_season_navigation';
import type { Library } from '../library/use_library';
import { Icon } from '../ui/icon';
import { EpisodeSidebar, Neighbors } from './episodes';
import { FinishedPrompt } from './finished';
import { FRAME_PERMISSIONS, PROVIDERS } from './providers';
import { SourceChoices } from './sources';
import { use_playback_source } from './use_playback_source';

export function Player({ title, remembered_source, library }: { title: Title; remembered_source: string | null; library: Library }) {
  const sources = PROVIDERS.filter(provider => provider.url(title));
  const { provider, choose, error } = use_playback_source(title.id, sources, remembered_source);
  const url = provider?.url(title) ?? null;
  const series = title.kind === 'episode' ? title.series : null;
  const seasons = use_season_navigation(series ? title.id : null);
  const playable = sources.length > 0;
  const details = [title.year, runtime(title.minutes)].filter(Boolean);

  useEffect(() => {
    if (playable) void library.remember(title.id);
  }, [library.remember, title.id, playable]);

  return <div className={`watch page-gutter${series ? '' : ' watch-single'}`}>
    <section className="watch-main" aria-labelledby="watch-title">
      <a className="back-link" href={`#/title/${series?.id ?? title.id}`}><Icon name="chevron" className="previous" />{series?.title ?? title.title}</a>
      <div className="player-surface">
        {url ? <iframe key={url} title={`${title.title} player`} src={url} allow={FRAME_PERMISSIONS} allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin" /> : <p className="player-unavailable">Playback is unavailable for this title.</p>}
      </div>
      <div className="watch-heading">
        <div className="watch-name">
          <h1 id="watch-title">{series ? `${episode_code(title)} · ${title.title}` : title.title}</h1>
          {details.length > 0 && <p className="meta">{details.map(detail => <span key={detail}>{detail}</span>)}</p>}
        </div>
        {series && <Neighbors episode={title} navigation={seasons.navigation} />}
      </div>
      <SourceChoices sources={sources} provider={provider} error={error} on_choose={choose} />
      <FinishedPrompt title={title} library={library} />
    </section>
    {series && <EpisodeSidebar episode={title} series={series} seasons={seasons} library={library} />}
  </div>;
}
