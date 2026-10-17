import type { Library } from '../../library/use_library';
import type { CatalogEntry } from '../types';
import { Card } from './card';

export function TitleGrid({ entries, library }: { entries: readonly CatalogEntry[]; library: Library }) {
  return <div className="title-grid">{entries.map(entry => <Card entry={entry} key={entry.id} library={library} />)}</div>;
}
