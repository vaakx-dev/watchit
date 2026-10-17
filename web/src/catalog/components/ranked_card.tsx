import type { Library } from '../../library/use_library';
import type { CatalogEntry } from '../types';
import { Card } from './card';

export function RankedCard({ rank, entry, library }: { rank: number; entry: CatalogEntry; library: Library }) {
  return <div className="ranked-card">
    <span className="rank" aria-hidden="true">{rank}</span>
    <Card entry={entry} library={library} />
  </div>;
}
