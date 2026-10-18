import { useState } from 'react';
import type { CatalogEntry, CatalogQuery } from '../../catalog/types';
import { NearEnd } from '../../ui/near_end';
import { ResultPage, type RenderEntry } from './result_page';

export function ResultList({ className, entries, has_next, request, render }: {
  className: string;
  entries: readonly CatalogEntry[];
  has_next: boolean;
  request: Omit<CatalogQuery, 'page'>;
  render: RenderEntry;
}) {
  const [pages, set_pages] = useState(1);
  const more = () => set_pages(count => count + 1);

  return <div className={className}>
    {entries.map(render)}
    {pages === 1 && has_next && <NearEnd on_reach={more} />}
    {Array.from({ length: pages - 1 }, (_, index) => <ResultPage key={index + 2} request={request} page={index + 2} last={index + 2 === pages}
      render={render} on_more={more} />)}
  </div>;
}
