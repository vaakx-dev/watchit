import type { Title } from '../catalog/types';

type PlaybackTitle = Pick<Title, 'kind' | 'imdb_id' | 'tmdb_id' | 'season' | 'episode' | 'series' | 'provider_ids'>;

export type Provider = {
  id: string;
  name: string;
  url: (title: PlaybackTitle) => string | null;
};

function episode_reference(title: PlaybackTitle) {
  const id = title.series?.imdb_id ?? title.series?.tmdb_id;
  if (!id || title.season === null || title.episode === null || title.season < 0 || title.episode < 1) return null;
  return { id, season: title.season, episode: title.episode };
}

export const PROVIDERS = [
  {
    id: '2embed',
    name: '2embed',
    url: (title: PlaybackTitle) => {
      if (title.kind === 'episode') {
        const reference = episode_reference(title);
        return reference ? `https://www.2embed.cc/embedtv/${reference.id}&s=${reference.season}&e=${reference.episode}` : null;
      }
      const id = title.imdb_id ?? title.tmdb_id;
      if (!id) return null;
      return `https://www.2embed.cc/${title.kind === 'series' ? 'embedtvfull' : 'embed'}/${id}`;
    },
  },
  {
    id: 'smashy',
    name: 'SmashyStream',
    url: (title: PlaybackTitle) => title.kind === 'movie' && title.imdb_id ? `https://embed.smashystream.com/playere.php?imdb=${title.imdb_id}` : null,
  },
  {
    id: 'vidsrc',
    name: 'VidSrc',
    url: (title: PlaybackTitle) => {
      if (title.kind === 'episode') {
        const reference = episode_reference(title);
        return reference ? `https://vidsrc.me/embed/tv/${reference.id}/${reference.season}/${reference.episode}` : null;
      }
      const id = title.imdb_id ?? title.tmdb_id;
      if (!id) return null;
      return title.kind === 'series' ? `https://vidsrc.me/embed/tv/${id}` : `https://vidsrc.me/embed/${id}/`;
    },
  },
  {
    id: 'one-anime',
    name: '1Anime',
    url: (title: PlaybackTitle) => title.provider_ids?.one_anime ? `https://my.1anime.site/play/${title.provider_ids.one_anime}` : null,
  },
  {
    id: 'vidplus',
    name: 'VidPlus',
    url: (title: PlaybackTitle) => title.kind === 'movie' && title.tmdb_id ? `https://player.vidplus.to/embed/movie/${title.tmdb_id}` : null,
  },
] as const satisfies readonly Provider[];

export function pick_provider(sources: readonly Provider[], remembered: string | null) {
  return sources.find(source => source.id === remembered) ?? sources.find(source => source.id === 'one-anime') ?? sources[0];
}

export const FRAME_PERMISSIONS = 'autoplay; fullscreen *; encrypted-media; picture-in-picture';
