import type { CatalogEntry } from '../../catalog/types';
import type { Library } from '../use_library';
import { RatingControl } from './rating';

export function TitleRating({ title, library }: { title: CatalogEntry; library: Library }) {
  return <RatingControl key={title.id} title={title.title} value={library.entries[title.id]?.rating ?? null}
    disabled={!library.ready}
    on_change={rating => library.update(title.id, { rating })} />;
}
