import { genre_id, IMDB_ID } from '../../src/catalog/identity.ts';
import type { CatalogEntry, CatalogQuery, EpisodeEntry, ImageCredit, Title } from '../../src/catalog/types.ts';
import type { Images } from '../media/types.ts';
import type { ImportedTitle, Store } from '../storage/types.ts';
import { genre_ids } from './genres.ts';
import { CatalogError, type Http, type RequestPriority } from './http.ts';
import { Mapping, type CatalogTitle } from './mapping.ts';
import { BASE_URL, meta_url, project_meta, RESPONSE_KEY, type Kind, type Manifest, type Meta } from './schema.ts';

export const PAGE_SIZE = 24;
const SOURCE_PAGE_SIZE = 50;
export type CatalogData = {
  items: CatalogEntry[]; has_next: boolean; genres: ImportedTitle['genres']; images: ImageCredit[]; titles: CatalogTitle[];
};
export type EpisodeData = { items: EpisodeEntry[]; has_next: boolean; images: ImageCredit[]; titles: ImportedTitle[] };
type SourceOptions = { cache?: Pick<Store, 'cache_get' | 'cache_set' | 'settings_get'> };
export type SourceRequestOptions = {
  priority?: RequestPriority;
  before_request?: () => void | Promise<void>;
};

export class Source {
  private readonly mapping: Mapping;
  private readonly in_flight = new Map<string, Promise<unknown>>();
  private request_context: SourceRequestOptions | undefined;

  constructor(private readonly http: Http, images: Images, private readonly options: SourceOptions = {}) {
    this.mapping = new Mapping(images);
  }

  async with_request_options<T>(request_options: SourceRequestOptions, operation: () => Promise<T>): Promise<T> {
    const previous = this.request_context;
    this.request_context = request_options;
    try {
      return await operation();
    } finally {
      this.request_context = previous;
    }
  }

  private async get<T>(url: string, project: (data: T) => T): Promise<T> {
    const request_options = this.request_context ?? {};
    const key = `${RESPONSE_KEY}${url}`;
    const read_cache = () => {
      const cached = this.options.cache?.cache_get<T>(key);
      const ttl = (this.options.cache?.settings_get().metadata_hours ?? 0) * 3600000;
      return cached && Date.now() >= cached.updated_at && Date.now() - cached.updated_at < ttl ? cached.value : undefined;
    };
    const cached = read_cache();
    if (cached !== undefined) return cached;

    let operation = this.in_flight.get(key);
    if (!operation) {
      await request_options.before_request?.();
      const after_yield = read_cache();
      if (after_yield !== undefined) return after_yield;
      operation = this.in_flight.get(key);
      if (!operation) {
        operation = this.http.get<T>(url, request_options.priority ?? 'background')
          .then(project)
          .then(response => {
            this.options.cache?.cache_set(key, response);
            return response;
          });
        this.in_flight.set(key, operation);
      }
    }
    try {
      return await operation as T;
    } finally {
      if (this.in_flight.get(key) === operation) this.in_flight.delete(key);
    }
  }

  async catalog(query: CatalogQuery): Promise<CatalogData> {
    const kinds: Kind[] = query.kind === 'movie' || query.kind === 'series' ? [query.kind] : ['movie', 'series'];
    const titles = new Map<string, CatalogTitle>();
    let has_next = false;
    for (const kind of kinds) {
      const extras: string[] = [];
      if (query.genre || query.kind === 'anime') {
        const manifest = await this.get<Manifest>(`${BASE_URL}/manifest.json`, data => ({ catalogs: data.catalogs
          .filter(item => item.id === 'top').map(({ type, id, genres }) => ({ type, id, genres })) }));
        const wanted = genre_ids(query.kind === 'anime' ? 'animation' : query.genre);
        const genre = manifest.catalogs.find(catalog => catalog.type === kind && catalog.id === 'top')?.genres
          ?.find(label => genre_ids(genre_id(label)).some(id => wanted.includes(id)));
        if (!genre) continue;
        extras.push(`genre=${encodeURIComponent(genre)}`);
      }
      if (query.query) extras.push(`search=${encodeURIComponent(query.query)}`);
      // Cinemeta search ignores skip and returns a bounded result set.
      if (query.query && query.page > 1) continue;
      const url_for = (page: number) => `${BASE_URL}/catalog/${kind}/top/${[...extras, `skip=${(page - 1) * SOURCE_PAGE_SIZE}`].join('&')}.json`;
      const response = await this.get<{ metas: Meta[] }>(url_for(query.page), data => ({ metas: data.metas.map(meta => project_meta(meta, false)) }));
      const previous = query.page > 1
        ? this.options.cache?.cache_get<{ metas: Meta[] }>(`${RESPONSE_KEY}${url_for(query.page - 1)}`)?.value : undefined;
      const repeated = previous && response.metas.length > 0 && response.metas.every(meta => previous.metas.some(item => item.id === meta.id));
      if (!query.query && response.metas.length > 0 && !repeated) has_next = true;
      for (const meta of response.metas) {
        const item = this.mapping.imported(meta);
        if (item) titles.set(item.title.id, item);
      }
    }
    const imported = [...titles.values()];
    return {
      titles: imported, items: imported.map(item => item.title), has_next,
      genres: [...new Map(imported.flatMap(item => item.genres).map(genre => [genre.id, genre])).values()],
      images: imported.flatMap(item => item.title.images),
    };
  }

  async title(id: string, kind?: Kind): Promise<{ title: Title; parents: CatalogEntry[]; titles: ImportedTitle[]; verified_at: number }> {
    const [parent_id, season, episode] = id.split(':');
    if (!parent_id || !IMDB_ID.test(parent_id)) throw new CatalogError('Cinemeta requires an IMDb ID.', 400);
    const kinds: Kind[] = season !== undefined ? ['series'] : kind ? [kind] : ['movie', 'series'];
    for (const candidate of kinds) {
      let response: { meta?: Meta | null };
      try { response = await this.get<{ meta?: Meta | null }>(meta_url(candidate, parent_id), data => ({ meta: data.meta ? project_meta(data.meta, true) : data.meta })); }
      catch (error) {
        if (error instanceof CatalogError && error.status === 404) continue;
        throw error;
      }
      const meta = response.meta;
      if (!meta || meta.id !== parent_id || meta.type !== candidate) continue;
      const parent = this.mapping.imported(meta);
      if (!parent) continue;
      const titles = [parent, ...(candidate === 'series' ? this.mapping.episodes(meta, parent) : [])];
      const title = season === undefined ? parent.title
        : titles.find(item => item.title.id === `${parent_id}:${Number(season)}:${Number(episode)}`)?.title;
      if (title) return {
        title, parents: season === undefined ? [] : [parent.title], titles,
        verified_at: this.options.cache?.cache_get(`${RESPONSE_KEY}${meta_url(candidate, parent_id)}`)?.updated_at ?? Date.now(),
      };
    }
    throw new CatalogError('This title is not available from Cinemeta.', 404);
  }

  async episodes(id: string, page: number): Promise<EpisodeData> {
    const result = await this.title(id, 'series');
    const episodes = result.titles.filter(item => item.title.kind === 'episode');
    const titles = episodes.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    return {
      items: titles.map(item => ({ ...item.title, kind: 'episode' as const })), titles,
      images: titles.flatMap(item => item.title.images), has_next: episodes.length > page * PAGE_SIZE,
    };
  }
}
