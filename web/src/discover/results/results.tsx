import { useState } from 'react';
import { Search, X } from 'lucide-react';
import { Card, type CardMeta } from '../../catalog/components/card';
import { GridSkeleton } from '../../catalog/components/skeleton';
import { CatalogStatus } from '../../catalog/components/status';
import { awaiting_items, type use_catalog } from '../../catalog/api';
import type { CatalogQuery } from '../../catalog/types';
import type { Library } from '../../library/use_library';
import { EmptyState } from '../../ui/empty_state';
import { NearEnd } from '../../ui/near_end';
import { NextPage } from './next_page';

export function Results({ first, query, meta, library, on_reset }: {
  first: ReturnType<typeof use_catalog>;
  query: Omit<CatalogQuery, 'page'>;
  meta: CardMeta;
  library: Library;
  on_reset: (() => void) | null;
}) {
  const [pages, set_pages] = useState(1);
  const { resource, retry } = first;
  if (resource.status === 'error') return <CatalogStatus error={resource.error} retry={retry} />;
  if (resource.status !== 'ready' || awaiting_items(resource)) return <GridSkeleton />;
  const { items, has_next, imports } = resource.data;
  if (!items.length && imports.error) return <CatalogStatus error={imports.error} retry={retry} />;
  if (!items.length) return <EmptyState icon={Search} title="No titles found">
    <p>{on_reset ? 'Change or reset the filters.' : 'The catalog is still empty.'}</p>
    {on_reset && <button className="button secondary" onClick={on_reset}><X />Reset filters</button>}
  </EmptyState>;

  const more = () => set_pages(count => count + 1);
  return <div className="title-grid">
    {items.map(entry => <Card entry={entry} key={entry.id} library={library} meta={meta} />)}
    {pages === 1 && has_next && <NearEnd on_reach={more} />}
    {Array.from({ length: pages - 1 }, (_, index) => <NextPage key={index + 2} query={query} page={index + 2} last={index + 2 === pages}
      meta={meta} library={library} on_more={more} />)}
  </div>;
}
