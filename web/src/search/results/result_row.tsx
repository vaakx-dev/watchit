import { memo } from 'react';
import { Artwork } from '../../catalog/components/artwork';
import { ImdbScore } from '../../catalog/components/imdb_score';
import type { CatalogEntry } from '../../catalog/types';
import { StatusControls } from '../../library/components/status';
import { kind_label } from '../../library/pages/kinds';
import type { Library } from '../../library/use_library';
import { Highlight } from './highlight';

export const ResultRow = memo(function ResultRow({ entry, query, library }: { entry: CatalogEntry; query: string; library: Library }) {
  const href = `#/title/${entry.id}`;
  return <li className="result-row">
    <a className="result-link" href={href} aria-label={`${entry.title}${entry.year ? `, ${entry.year}` : ''}`}>
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
    <StatusControls title={entry} library={library} />
  </li>;
});
