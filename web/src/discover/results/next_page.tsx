import { CardSkeleton } from '../../catalog/components/skeleton';
import { Card, type CardMeta } from '../../catalog/components/card';
import { use_catalog } from '../../catalog/api';
import type { CatalogQuery } from '../../catalog/types';
import type { Library } from '../../library/use_library';
import { NearEnd } from '../../ui/near_end';

const LOADING_CARDS = 6;

export function NextPage({ query, page, last, meta, library, on_more }: {
  query: Omit<CatalogQuery, 'page'>;
  page: number;
  last: boolean;
  meta: CardMeta;
  library: Library;
  on_more: () => void;
}) {
  const { resource, retry } = use_catalog({ ...query, page });
  if (resource.status === 'error') return <div className="results-retry" role="alert">
    <p>{resource.error}</p>
    <button type="button" className="button secondary small" onClick={retry}>Try again</button>
  </div>;
  if (resource.status !== 'ready') return Array.from({ length: LOADING_CARDS }, (_, index) => <CardSkeleton key={index} />);
  return <>
    {resource.data.items.map(entry => <Card entry={entry} key={entry.id} library={library} meta={meta} />)}
    {last && resource.data.has_next && <NearEnd on_reach={on_more} />}
  </>;
}
