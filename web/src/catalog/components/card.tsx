import { memo } from 'react';
import { StatusControls } from '../../library/components/status';
import type { Library } from '../../library/use_library';
import { Artwork } from './artwork';
import type { CatalogEntry } from '../types';

function kind_label({ kind, anime }: CatalogEntry) {
  if (kind === 'episode') return '';
  if (anime) return kind === 'movie' ? 'Anime movie' : 'Anime series';
  return kind === 'movie' ? 'Movie' : 'Series';
}

export const Card = memo(function Card({ entry, library }: { entry: CatalogEntry; library: Library }) {
  const details = [kind_label(entry), entry.year, entry.genres[0]].filter(Boolean).join(' · ');

  return <article className="title-card">
    <a className="card-link" href={`#/title/${entry.id}`} aria-label={`${entry.title}${entry.year ? `, ${entry.year}` : ''}`} title={entry.title}>
      <div className="card-image"><Artwork src={entry.artwork} label={entry.title} /></div>
      <h3>{entry.title}</h3>
      <p className="card-meta">{details}</p>
    </a>
    {entry.kind !== 'episode' && <div className="card-status"><StatusControls title={entry} library={library} /></div>}
  </article>;
});
