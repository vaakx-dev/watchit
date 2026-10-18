import { Play } from 'lucide-react';
import { use_title } from '../../catalog/api';
import { Artwork } from '../../catalog/components/artwork';
import { ImdbScore } from '../../catalog/components/imdb_score';
import { runtime } from '../../catalog/format';
import type { CatalogEntry } from '../../catalog/types';
import { StatusControls } from '../../library/components/status';
import { kind_label } from '../../library/pages/kinds';
import type { Library } from '../../library/use_library';

function play_href(entry: CatalogEntry, next: string | undefined) {
  if (entry.kind !== 'series') return `#/watch/${entry.id}`;
  return next ? `#/watch/${next}` : undefined;
}

export function TopResult({ entry, library, compact }: { entry: CatalogEntry; library: Library; compact: boolean }) {
  const { resource } = use_title(entry.id);
  const result = resource.status === 'ready' ? resource.data : undefined;
  const minutes = entry.kind === 'movie' ? result?.title.minutes ?? null : null;
  const play = play_href(entry, result?.progress?.next?.id);
  const href = `#/title/${entry.id}`;
  const score = <ImdbScore score={entry.imdb_rating} />;

  return <article className="top-result" aria-label={`Top result: ${entry.title}`}>
    <a className="top-result-poster" href={href} tabIndex={-1} aria-hidden="true"><Artwork src={entry.artwork} label={entry.title} eager /></a>
    <div className="top-result-copy">
      <h3><a href={href}>{entry.title}</a></h3>
      <p className="meta">
        <span>{kind_label(entry)}</span>
        {entry.year && <span>{entry.year}</span>}
        {minutes ? <span>{runtime(minutes)}</span> : null}
        {compact && score}
      </p>
      {!compact && entry.imdb_rating !== null && <p className="meta">{score}</p>}
      <StatusControls title={entry} library={library} labelled />
      <div className="top-result-actions">
        {play && <a className="button primary small" href={play}><Play fill="currentColor" />Play</a>}
        {compact && <a className="button secondary small" href={href}>Details</a>}
      </div>
    </div>
  </article>;
}
