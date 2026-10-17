import { genre_id } from '../../src/catalog/identity.ts';
import type { Title } from '../../src/catalog/types.ts';
import type { ImportedTitle } from '../storage/types.ts';
import type { CatalogTitle } from './mapping.ts';

export function merge_catalog(item: CatalogTitle, previous: Title | undefined): ImportedTitle {
  if (!previous || previous.kind !== item.title.kind) return item;
  const title = { ...previous };
  function copy<K extends keyof Title>(key: K) { title[key] = item.title[key]; }
  item.present.forEach(copy);
  title.images = [
    ...previous.images.filter(image => image.source === 'cinemeta'
      && !(image.role === 'poster' && item.present.includes('artwork'))
      && !(image.role === 'backdrop' && item.present.includes('backdrop'))),
    ...item.title.images,
  ];
  title.artwork = title.images.find(image => image.role === 'poster')?.url ?? '';
  title.backdrop = title.images.find(image => image.role === 'backdrop')?.url ?? '';
  return { title, genres: title.genres.map(label => ({ id: genre_id(label), label })) };
}
