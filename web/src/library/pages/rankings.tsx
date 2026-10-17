import { Trophy } from 'lucide-react';
import { useState } from 'react';
import { Choices, type Choice } from '../../ui/choices';
import { EmptyState } from '../../ui/empty_state';
import { Page } from '../../ui/page';
import { CatalogStatus } from '../../catalog/components/status';
import type { CatalogKind } from '../../catalog/types';
import { mine_route } from '../../navigation/route';
import { use_rankings } from '../use_rankings';
import { KINDS, plural } from './kinds';
import { RankedList } from './ranked_list';
import { RankingTiers } from './ranking_tiers';

type View = 'tiers' | 'ranked';

const VIEWS: readonly Choice<View>[] = [{ value: 'tiers', label: 'Tiers' }, { value: 'ranked', label: 'Ranked' }];

function Empty({ kind, show_all }: { kind: CatalogKind; show_all: () => void }) {
  if (kind !== 'all') return <EmptyState icon={Trophy} title={`No rated ${plural(kind)}`}>
    <p>Your other ratings may be here. Show every type to check.</p>
    <button type="button" className="button secondary" onClick={show_all}>Show all types</button>
  </EmptyState>;
  return <EmptyState icon={Trophy} title="Nothing rated yet">
    <p>Give a title stars on its page and it lines up here by rating. Start with what you’ve watched.</p>
    <a className="button primary" href={mine_route('watched')}>Rate what you’ve watched</a>
  </EmptyState>;
}

function Ranking({ kind, view, show_all }: { kind: CatalogKind; view: View; show_all: () => void }) {
  const { rankings, resource, retry, error, reorder } = use_rankings(kind);
  if (!rankings) return <CatalogStatus error={resource.status === 'error' ? resource.error : undefined} retry={retry} message="Loading your rankings." />;
  if (!rankings.tiers.length) return <Empty kind={kind} show_all={show_all} />;
  return <>
    {error && <p className="ranking-error" role="alert">That move wasn’t saved, so the order is back as it was. {error}</p>}
    {view === 'tiers' ? <RankingTiers rankings={rankings} /> : <RankedList rankings={rankings} reorder={reorder} />}
  </>;
}

export function Rankings() {
  const [kind, set_kind] = useState<CatalogKind>('all');
  const [view, set_view] = useState<View>(() => window.matchMedia('(max-width: 760px)').matches ? 'ranked' : 'tiers');

  return <Page title="Rankings">
    <div className="ranking-toolbar">
      <Choices label="Type" look="segmented" options={KINDS} value={kind} on_change={set_kind} />
      <Choices look="segmented" label="Layout" options={VIEWS} value={view} on_change={set_view} />
    </div>
    <div className="ranking-body"><Ranking key={kind} kind={kind} view={view} show_all={() => set_kind('all')} /></div>
  </Page>;
}
