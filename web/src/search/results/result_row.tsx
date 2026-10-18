import { memo, useRef } from 'react';
import { Artwork } from '../../catalog/components/artwork';
import { ImdbScore } from '../../catalog/components/imdb_score';
import type { CatalogEntry } from '../../catalog/types';
import { StatusControls, type StatusMenuHandle } from '../../library/components/status';
import { kind_label } from '../../library/pages/kinds';
import type { Library } from '../../library/use_library';
import { use_long_press } from '../../ui/use_long_press';
import { Highlight } from './highlight';

export const ResultRow = memo(function ResultRow({ entry, query, library }: { entry: CatalogEntry; query: string; library: Library }) {
  const status = useRef<StatusMenuHandle>(null);
  const press = use_long_press(() => status.current?.open());

  return <article className="result-row" {...press}>
    <a className="result-link" href={`#/title/${entry.id}`} aria-label={`${entry.title}${entry.year ? `, ${entry.year}` : ''}`}>
      <span className="result-poster"><Artwork src={entry.artwork} label={entry.title} /></span>
      <span className="result-copy">
        <span className="result-title"><Highlight text={entry.title} query={query} /></span>
        <span className="meta">
          <span>{kind_label(entry)}</span>
          {entry.year && <span>{entry.year}</span>}
          <ImdbScore score={entry.imdb_rating} />
        </span>
      </span>
    </a>
    <StatusControls title={entry} library={library} ref={status} />
  </article>;
});
