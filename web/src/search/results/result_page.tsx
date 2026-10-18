import type { ReactNode } from 'react';
import { use_catalog } from '../../catalog/api';
import type { CatalogEntry, CatalogQuery } from '../../catalog/types';
import { NearEnd } from '../../ui/near_end';

export type RenderEntry = (entry: CatalogEntry) => ReactNode;

export function ResultPage({ request, page, last, render, on_more }: {
  request: Omit<CatalogQuery, 'page'>;
  page: number;
  last: boolean;
  render: RenderEntry;
  on_more: () => void;
}) {
  const { resource, retry } = use_catalog({ ...request, page });
  if (resource.status === 'error') return <div className="results-retry" role="alert">
    <p>{resource.error}</p>
    <button type="button" className="button secondary small" onClick={retry}>Try again</button>
  </div>;
  if (resource.status !== 'ready') return <div className="result-loading" role="status" aria-label="Loading more results"><span className="skeleton-line" /></div>;
  return <>
    {resource.data.items.map(render)}
    {last && resource.data.has_next && <NearEnd on_reach={on_more} />}
  </>;
}
