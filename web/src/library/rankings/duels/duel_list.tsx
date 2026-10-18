import { Swords } from 'lucide-react';
import { use_resource } from '../../../catalog/api';
import { Artwork } from '../../../catalog/components/artwork';
import { CatalogStatus } from '../../../catalog/components/status';
import type { CatalogKind } from '../../../catalog/types';
import type { DuelRanking } from '../../../generated/library/DuelRanking';
import { EmptyState } from '../../../ui/empty_state';
import './duels.css';

export function DuelList({ kind, duel }: { kind: CatalogKind; duel: string }) {
  const { resource, retry } = use_resource<DuelRanking>(`/api/rankings/duels/ranked?kind=${kind}`);
  if (resource.status !== 'ready') return <CatalogStatus error={resource.status === 'error' ? resource.error : undefined} retry={retry} message="Loading your rankings." />;
  if (!resource.data.items.length) return <EmptyState icon={Swords} title="No duels yet">
    <a className="button primary" href={duel}>Duel</a>
  </EmptyState>;
  return <ol className="ranked-list duel-list">
    {resource.data.items.map(standing => <li className="ranked-row" key={standing.title.id}>
      <span className="ranked-number">{standing.rank}</span>
      <a className="ranked-poster" href={`#/title/${standing.title.id}`} tabIndex={-1} aria-hidden="true"><Artwork src={standing.title.artwork} label={standing.title.title} /></a>
      <div className="ranked-copy"><h3><a href={`#/title/${standing.title.id}`}>{standing.title.title}</a></h3></div>
      <span className="duel-rating">{standing.rating}</span>
    </li>)}
  </ol>;
}
