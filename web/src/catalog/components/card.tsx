import { memo, useRef } from 'react';
import { Play } from 'lucide-react';
import { StatusControls, type StatusMenuHandle } from '../../library/components/status';
import type { Library } from '../../library/use_library';
import { use_long_press } from '../../ui/use_long_press';
import { Artwork } from './artwork';
import { CardBadge } from './card_badge';
import type { CatalogEntry } from '../types';

export type CardMeta = 'kind' | 'rating';

function kind_label({ kind, anime }: CatalogEntry) {
  if (kind === 'episode') return '';
  if (anime) return kind === 'movie' ? 'Anime movie' : 'Anime series';
  return kind === 'movie' ? 'Movie' : 'Series';
}

function details(entry: CatalogEntry, meta: CardMeta) {
  const parts = meta === 'kind' ? [kind_label(entry), entry.year] : [entry.year, entry.imdb_rating?.toFixed(1)];
  return parts.filter(Boolean).join(' · ');
}

export const Card = memo(function Card({ entry, library, meta = 'kind', position }: {
  entry: CatalogEntry;
  library: Library;
  meta?: CardMeta;
  position?: number;
}) {
  const status = useRef<StatusMenuHandle>(null);
  const markable = entry.kind !== 'episode';
  const press = use_long_press(() => status.current?.open());

  return <article className="title-card" {...(markable ? press : {})}>
    <a className="card-link" href={`#/title/${entry.id}`} aria-label={`${entry.title}${entry.year ? `, ${entry.year}` : ''}`} title={entry.title}>
      <div className="card-image">
        <Artwork src={entry.artwork} label={entry.title} />
        {markable && <CardBadge entry={library.entries[entry.id]} />}
      </div>
      <h3>{position !== undefined && `${position} · `}{entry.title}</h3>
      <p className="card-meta">{details(entry, meta)}</p>
    </a>
    {markable && <div className="card-actions">
      <a className="card-play" href={`#/watch/${entry.id}`} aria-label={`Play ${entry.title}`}><Play fill="currentColor" />Play</a>
      <StatusControls title={entry} library={library} ref={status} />
    </div>}
  </article>;
});
