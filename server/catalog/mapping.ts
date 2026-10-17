import { genre_id, IMDB_ID } from '../../src/catalog/identity.ts';
import type { ImageCredit, ImdbId, Title, Trailer } from '../../src/catalog/types.ts';
import type { Images } from '../media/types.ts';
import { backdrop_url } from '../media/urls.ts';
import type { ImportedTitle } from '../storage/types.ts';
import { meta_url, type Meta, type MetaTrailer, type Video } from './schema.ts';

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

export type CatalogTitle = ImportedTitle & { present: (keyof Title)[] };

function year(value: string | undefined): number | null {
  const match = /^(\d{4})/.exec(value ?? '');
  return match ? Number(match[1]) : null;
}
function names(value: string[] | string | null | undefined) { return Array.isArray(value) ? value.join(', ') : value ?? ''; }
function imdb_rating(value: string | undefined): number | null {
  const rating = Number(value);
  return value && rating > 0 && rating <= 10 ? rating : null;
}
function trailers(values: MetaTrailer[] | undefined): Trailer[] {
  const ids = (values ?? []).flatMap(({ source, type }) => type === 'Trailer' && typeof source === 'string' && YOUTUBE_ID.test(source) ? [source] : []);
  return [...new Set(ids)].map(id => ({ id }));
}
function coordinate(value: number | undefined): value is number {
  return value !== undefined && Number.isSafeInteger(value) && value >= 0 && value <= 99999;
}

export class Mapping {
  constructor(private readonly images: Images) {}

  private image(source_url: string | undefined, role: ImageCredit['role'], description_url: string): ImageCredit[] {
    if (!source_url) return [];
    try {
      const url = role === 'backdrop' ? backdrop_url(source_url) : this.images.register(source_url);
      const terms_url = new URL(source_url).hostname === 'm.media-amazon.com'
        ? 'https://www.imdb.com/conditions' : 'https://www.metahub.space/terms';
      return [{ source: 'cinemeta', role, source_url, description_url, terms_url,
        author: '', license: '', license_url: '', url }];
    } catch { return []; }
  }

  imported(meta: Meta): CatalogTitle | null {
    if (IMDB_ID.exec(meta.id)?.[0] !== meta.id || !['movie', 'series'].includes(meta.type) || !meta.name?.trim()) return null;
    const genres = [...new Set(meta.genres ?? meta.genre ?? [])].map(label => ({ id: genre_id(label), label })).filter(item => item.id);
    const source_url = meta_url(meta.type, meta.id);
    const images = [...this.image(meta.poster, 'poster', source_url), ...this.image(meta.background, 'backdrop', source_url)];
    const runtime = /^(\d+)\s*(?:min|minutes)?$/.exec(meta.runtime ?? '');
    const countries = (Array.isArray(meta.country) ? meta.country : (meta.country ?? '').split(',')).map(value => value.trim().toLowerCase());
    const animation = genres.some(genre => genre.id === 'animation');
    const anime = genres.some(genre => genre.id === 'anime') || (animation && countries.includes('japan'));
    const present: (keyof Title)[] = ['id', 'imdb_id', 'title', 'kind', 'source_url'];
    if (meta.genres !== undefined || meta.genre !== undefined) {
      present.push('genres');
      if (anime || !animation || meta.country !== undefined) present.push('anime');
    }
    if (meta.releaseInfo !== undefined || meta.year !== undefined || meta.released !== undefined) present.push('year');
    if (meta.runtime !== undefined) present.push('minutes');
    if (meta.description !== undefined) present.push('synopsis');
    if (meta.director !== undefined) present.push('director');
    if (meta.cast !== undefined) present.push('cast');
    if (meta.moviedb_id !== undefined) present.push('tmdb_id');
    if (meta.poster !== undefined) present.push('artwork');
    if (meta.background !== undefined) present.push('backdrop');
    if (meta.imdbRating !== undefined) present.push('imdb_rating');
    if (meta.popularity !== undefined) present.push('popularity');
    if (meta.trailers !== undefined) present.push('trailers');
    return { genres, present, title: {
      id: meta.id, imdb_id: meta.id as ImdbId, title: meta.name, kind: meta.type,
      anime, genres: genres.map(genre => genre.label),
      year: year(meta.releaseInfo ?? meta.year ?? meta.released),
      artwork: images.find(image => image.role === 'poster')?.url ?? '',
      backdrop: images.find(image => image.role === 'backdrop')?.url ?? '', images, source_url,
      minutes: runtime && Number(runtime[1]) > 0 ? Number(runtime[1]) : null,
      synopsis: meta.description ?? '', director: names(meta.director), cast: names(meta.cast),
      tmdb_id: Number.isSafeInteger(meta.moviedb_id) && meta.moviedb_id! > 0 ? meta.moviedb_id! : null,
      imdb_rating: imdb_rating(meta.imdbRating), popularity: meta.popularity ?? null, trailers: trailers(meta.trailers),
      season: null, episode: null, series: null, related: [],
    } };
  }

  episodes(meta: Meta, parent: ImportedTitle): ImportedTitle[] {
    const values = new Map<string, ImportedTitle>();
    for (const video of meta.videos ?? []) {
      const item = this.episode(video, parent);
      if (item) values.set(item.title.id, item);
    }
    return [...values.values()].sort((a, b) => a.title.season! - b.title.season! || a.title.episode! - b.title.episode!);
  }

  private episode(video: Video, parent: ImportedTitle): ImportedTitle | null {
    const episode = video.episode ?? video.number;
    if (!coordinate(video.season) || !coordinate(episode)) return null;
    if (video.episode !== undefined && video.number !== undefined && video.episode !== video.number) return null;
    const id = `${parent.title.id}:${video.season}:${episode}`;
    if (video.id && video.id !== id) return null;
    const images = this.image(video.thumbnail, 'still', parent.title.source_url);
    const title: Title = {
      ...parent.title, id, title: video.name ?? video.title ?? `Episode ${episode}`, kind: 'episode',
      imdb_id: null, tmdb_id: null, imdb_rating: null, popularity: null, season: video.season, episode,
      year: year(video.released ?? video.firstAired), synopsis: video.description ?? video.overview ?? '',
      director: '', cast: '', minutes: null, trailers: [], images, artwork: images[0]?.url ?? '', backdrop: images[0]?.url ?? '',
      series: { id: parent.title.id, title: parent.title.title, imdb_id: parent.title.imdb_id, tmdb_id: parent.title.tmdb_id },
    };
    return { title, genres: parent.genres };
  }
}
