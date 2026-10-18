import { Trophy } from 'lucide-react';
import { Choices, type Choice } from '../../ui/choices';
import { EmptyState } from '../../ui/empty_state';
import { CatalogStatus } from '../../catalog/components/status';
import type { CatalogKind } from '../../catalog/types';
import { discover_route } from '../../navigation/route';
import { rankings_href, rate_href, type RankingLayout, type RankingsQuery } from '../../navigation/rankings';
import type { Rating } from '../types';
import type { Library } from '../use_library';
import { KINDS, plural } from '../pages/kinds';
import { Podium } from './podium';
import { RankedList } from './ranked_list';
import { RankingTiers } from './ranking_tiers';
import { RatePrompt } from './rate_prompt';
import { RateQueue } from './rate_queue';
import { use_rankings } from './use_rankings';
import { use_unrated } from './use_unrated';

const LAYOUTS: readonly Choice<RankingLayout>[] = [{ value: 'ranked', label: 'Ranked' }, { value: 'tiers', label: 'Tiers' }];

function Empty({ kind, unrated, rate, show_all }: { kind: CatalogKind; unrated: number; rate: string; show_all: () => void }) {
  if (unrated) return <EmptyState icon={Trophy} title={kind === 'all' ? 'Nothing rated yet' : `No rated ${plural(kind)}`}>
    <p>Rate what you’ve watched and it lines up here.</p>
    <a className="button primary" href={rate}>Rate {unrated} watched</a>
  </EmptyState>;
  if (kind !== 'all') return <EmptyState icon={Trophy} title={`No rated ${plural(kind)}`}>
    <p>Your other ratings may be here. Show every type to check.</p>
    <button type="button" className="button secondary" onClick={show_all}>Show all types</button>
  </EmptyState>;
  return <EmptyState icon={Trophy} title="Nothing rated yet">
    <p>Mark titles Watched or give them stars on their page, and they line up here by rating.</p>
    <a className="button primary" href={discover_route('all')}>Find something to watch</a>
  </EmptyState>;
}

function Ranking({ query, library }: { query: RankingsQuery; library: Library }) {
  const { rankings, resource, retry, error, reorder } = use_rankings(query.kind);
  const unrated = use_unrated(query.kind, library);
  const change = (next: Partial<RankingsQuery>) => window.location.replace(rankings_href({ ...query, ...next }));
  const rate = rate_href(query);

  async function rate_title(id: string, rating: Rating | null) {
    const saved = await library.update(id, { rating });
    retry();
    unrated.retry();
    return saved;
  }

  function body() {
    if (!rankings) return <CatalogStatus error={resource.status === 'error' ? resource.error : undefined} retry={retry} message="Loading your rankings." />;
    if (!rankings.tiers.length) return <Empty kind={query.kind} unrated={unrated.titles?.length ?? 0} rate={rate} show_all={() => change({ kind: 'all' })} />;
    return <>
      {error && <p className="ranking-error" role="alert">That move wasn’t saved, so the order is back as it was. {error}</p>}
      {query.layout === 'tiers'
        ? <RankingTiers rankings={rankings} unrated={unrated.titles} rate={rate} />
        : <><Podium rankings={rankings} /><RankedList rankings={rankings} reorder={reorder} /></>}
    </>;
  }

  return <div className="rankings-layout">
    <div className="rankings-main">
      <div className="ranking-toolbar">
        <div className="filter-switch">
          <Choices look="segmented" label="Layout" options={LAYOUTS} value={query.layout} on_change={layout => change({ layout })} />
        </div>
        <Choices look="pills" label="Type" options={KINDS} value={query.kind} on_change={kind => change({ kind })} />
      </div>
      {unrated.titles && unrated.titles.length > 0 && <RatePrompt titles={unrated.titles} rate={rate} />}
      {body()}
    </div>
    {unrated.titles && unrated.titles.length > 0 && <RateQueue titles={unrated.titles} rate={rate_title} />}
  </div>;
}

export function RankingsPage({ query, library }: { query: RankingsQuery; library: Library }) {
  return <section className="page page-gutter rankings-page" aria-labelledby="page-title">
    <h1 className="sr-only" id="page-title">Rankings</h1>
    <Ranking key={query.kind} query={query} library={library} />
  </section>;
}
