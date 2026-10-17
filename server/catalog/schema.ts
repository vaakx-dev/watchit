export const BASE_URL = 'https://v3-cinemeta.strem.io';
export const RESPONSE_KEY = 'cinemeta:response:v4:';
export type Kind = 'movie' | 'series';
export type Video = {
  id?: string; name?: string; title?: string; season?: number; episode?: number; number?: number;
  released?: string; firstAired?: string; description?: string; overview?: string; thumbnail?: string;
};
export type MetaTrailer = { source?: string; type?: string };
export type Meta = {
  id: string; imdb_id?: string; type: Kind; name: string; genres?: string[]; genre?: string[];
  releaseInfo?: string; year?: string; released?: string; runtime?: string; description?: string;
  director?: string[] | string | null; cast?: string[] | string | null; moviedb_id?: number;
  poster?: string; background?: string; country?: string | string[]; videos?: Video[];
  imdbRating?: string; popularity?: number; trailers?: MetaTrailer[];
};
export type Manifest = { catalogs: { type: Kind; id: string; genres?: string[] }[] };
export function meta_url(kind: Kind, id: string) { return `${BASE_URL}/meta/${kind}/${id}.json`; }

export function project_meta(meta: Meta, details: boolean): Meta {
  const { id, type, name, genres, genre, releaseInfo, year, released, runtime, description,
    director, cast, moviedb_id, poster, background, country, imdbRating, popularity, trailers } = meta;
  return { id, type, name, genres, genre, releaseInfo, year, released, runtime, description,
    director, cast, moviedb_id, poster, background, country, imdbRating, popularity,
    trailers: trailers?.map(({ source, type }) => ({ source, type })),
    ...(details && meta.videos ? { videos: meta.videos.map(video => {
      const { id, name, title, season, episode, number, released, firstAired, description, overview, thumbnail } = video;
      return { id, name, title, season, episode, number, released, firstAired, description, overview, thumbnail };
    }) } : {}),
  };
}
