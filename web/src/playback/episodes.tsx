import { useEffect, useRef } from 'react';
import { Artwork } from '../catalog/components/artwork';
import { EpisodePages } from '../catalog/components/episode_pages';
import { SeasonPicker } from '../catalog/components/season_picker';
import { episode_code, watched_summary } from '../catalog/episodes';
import type { EpisodeEntry, EpisodeNavigation, Title } from '../catalog/types';
import type { SeasonNavigation } from '../catalog/use_season_navigation';
import { StatusEye } from '../library/components/eye';
import { SeasonWatchedButton } from '../library/components/season_watched';
import type { Library } from '../library/use_library';
import { Icon } from '../ui/icon';

function Neighbor({ episode, season, next = false }: { episode: EpisodeEntry | null; season: number | null; next?: boolean }) {
  if (!episode) return null;
  const code = episode_code(episode, season);
  return <a className={`button secondary small${next ? ' watch-next' : ''}`} href={`#/watch/${episode.id}`}
    aria-label={`${next ? 'Next' : 'Previous'} episode, ${code}: ${episode.title}`}>
    {next ? <><span className="watch-next-word">Next episode · </span>{code}<Icon name="chevron" /></> : <><Icon name="chevron" className="previous" />{code}</>}
  </a>;
}

export function Neighbors({ episode, navigation }: { episode: Title; navigation: EpisodeNavigation | undefined }) {
  if (!navigation?.previous && !navigation?.next) return null;
  return <nav className="watch-neighbors" aria-label="Previous and next episode">
    <Neighbor episode={navigation.previous} season={episode.season} />
    <Neighbor episode={navigation.next} season={episode.season} next />
  </nav>;
}

function Loading() {
  return <div role="status" aria-label="Loading episodes"><ol className="watch-episode-list" aria-hidden="true">
    {[0, 1, 2, 3, 4].map(index => <li className="watch-episode" key={index}>
      <div className="watch-episode-still skeleton-block" />
      <span className="skeleton-line" />
    </li>)}
  </ol></div>;
}

function Note({ current, watched }: { current: boolean; watched: boolean }) {
  if (current) return <span className="watch-episode-note now-playing">Now playing</span>;
  if (watched) return <span className="watch-episode-note"><StatusEye status="watched" />Watched</span>;
  return null;
}

function List({ episode, navigation, library }: { episode: Title; navigation: EpisodeNavigation; library: Library }) {
  const list = useRef<HTMLOListElement>(null);

  useEffect(() => {
    const element = list.current;
    const row = element?.querySelector<HTMLElement>('[aria-current="true"]');
    if (!element || !row || element.scrollHeight <= element.clientHeight) return;
    element.scrollTop += row.getBoundingClientRect().top - element.getBoundingClientRect().top - (element.clientHeight - row.offsetHeight) / 2;
  }, [episode.id, navigation]);

  if (!navigation.items.length) return <p className="watch-note">This season has no episodes yet.</p>;
  return <ol ref={list} className="watch-episode-list">{navigation.items.map(item => <li key={item.id}>
    <a className="watch-episode" href={`#/watch/${item.id}`} aria-current={item.id === episode.id ? 'true' : undefined}>
      <div className="watch-episode-still"><Artwork src={item.artwork} /></div>
      <div className="watch-episode-copy">
        <span className="watch-episode-title">{item.episode} · {item.title}</span>
        <Note current={item.id === episode.id} watched={library.entries[item.id]?.status === 'watched'} />
      </div>
    </a>
  </li>)}</ol>;
}

function Body({ episode, seasons, library }: { episode: Title; seasons: SeasonNavigation; library: Library }) {
  const { navigation, loading, failure, retry } = seasons;
  if (loading) return <Loading />;
  if (failure) return <div className="watch-note" role="alert">{failure} <button className="button ghost small" onClick={retry}>Try again</button></div>;
  if (!navigation) return null;
  return <><List episode={episode} navigation={navigation} library={library} /><EpisodePages navigation={navigation} select_page={seasons.select_page} /></>;
}

export function EpisodeSidebar({ episode, series, seasons, library }: { episode: Title; series: NonNullable<Title['series']>; seasons: SeasonNavigation; library: Library }) {
  const { navigation, season } = seasons;
  const summary = navigation?.season === season ? watched_summary(navigation, library.entries) : null;

  return <aside className="watch-episodes" aria-label={`${series.title} episodes`}>
    <div className="watch-episodes-bar">
      <SeasonPicker seasons={navigation?.seasons ?? [season]} value={season} on_change={seasons.select_season} />
      {summary && <span className="season-summary">{summary}</span>}
      {navigation?.season === season && <SeasonWatchedButton series_id={series.id} navigation={navigation} library={library} />}
    </div>
    <Body episode={episode} seasons={seasons} library={library} />
  </aside>;
}
