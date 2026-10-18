import type { ReactNode } from 'react';
import { use_catalog } from '../../catalog/api';
import type { CatalogEntry, CatalogQuery } from '../../catalog/types';
import { NearEnd } from '../../ui/near_end';
import { PageRetry } from '../../ui/page_retry';

export type RenderEntry = (entry: CatalogEntry) => ReactNode;

export function ResultPage({ request, page, last, render, on_more }: {
  request: Omit<CatalogQuery, 'page'>;
  page: number;
  last: boolean;
  render: RenderEntry;
  on_more: () => void;
}) {
  const { resource, retry } = use_catalog({ ...request, page });
  if (resource.status === 'error') return <PageRetry error={resource.error} retry={retry} />;
  if (resource.status !== 'ready') return <div className="result-loading" role="status" aria-label="Loading more results"><span className="skeleton-line" /></div>;
  return <>
    {resource.data.items.map(render)}
    {last && resource.data.has_next && <NearEnd on_reach={on_more} />}
  </>;
}
