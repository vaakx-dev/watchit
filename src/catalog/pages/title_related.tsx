import { use_related } from '../api';
import { Card } from '../components/card';
import { Shelf } from '../components/shelf';
import { ShelfSkeleton } from '../components/skeleton';
import type { FranchiseEntry } from '../types';
import type { Library } from '../../library/use_library';

function FranchiseCard({ entry, library }: { entry: FranchiseEntry; library: Library }) {
  return <div className="franchise-card" aria-current={entry.current ? 'page' : undefined}>
    <span className="franchise-step">{entry.position}{entry.current && ' · You\u2019re here'}</span>
    <Card entry={entry} library={library} />
  </div>;
}

export function TitleRelated({ id, library }: { id: string; library: Library }) {
  const { resource } = use_related(id);
  if (resource.status === 'loading') return <ShelfSkeleton title="More like this" />;
  if (resource.status !== 'ready') return null;
  const { franchise, similar, pending } = resource.data;

  return <>
    {franchise
      ? <Shelf title="Prequels & sequels">{franchise.items.map(entry => <FranchiseCard entry={entry} key={entry.id} library={library} />)}</Shelf>
      : pending && <ShelfSkeleton title="Prequels & sequels" />}
    {similar.length > 0 && <Shelf title="More like this">{similar.map(entry => <Card entry={entry} key={entry.id} library={library} />)}</Shelf>}
  </>;
}
