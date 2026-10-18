import type { ReactNode } from 'react';
import { use_catalog } from '../../catalog/api';
import type { CatalogEntry, CatalogQuery } from '../../catalog/types';
import { use_sentinel } from '../../ui/use_sentinel';

type Request = Omit<CatalogQuery, 'page'>;
type Render = (entry: CatalogEntry) => ReactNode;

function ResultPage({ request, page, render }: { request: Request; page: number; render: Render }) {
  const { resource, retry } = use_catalog({ ...request, page });
  if (resource.status === 'error') return <li className="result-more">
    <button type="button" className="button secondary small" onClick={retry}>Load more results</button>
  </li>;
  if (resource.status !== 'ready') return <li className="result-more" role="status" aria-label="Loading more results"><span className="skeleton-line" /></li>;
  return <>
    {resource.data.items.map(render)}
    {resource.data.has_next && <NextPage request={request} page={page + 1} render={render} />}
  </>;
}

export function NextPage({ request, page, render }: { request: Request; page: number; render: Render }) {
  const { seen, ref } = use_sentinel();
  if (!seen) return <li ref={ref} className="result-more" aria-hidden="true" />;
  return <ResultPage request={request} page={page} render={render} />;
}
