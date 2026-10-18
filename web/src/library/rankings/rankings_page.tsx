import { CatalogStatus } from '../../catalog/components/status';
import { rankings_href, type RankingsQuery } from '../../navigation/rankings';
import type { Library } from '../use_library';
import { DuelList } from './duels/duel_list';
import { DuelScreen } from './duels/duel_screen';
import { layout_of, RankingToolbar } from './ranking_toolbar';
import { StarsRanking } from './stars_ranking';
import { use_ranking_system, type RankingSystem } from './system/use_ranking_system';

function Ranking({ query, library }: { query: RankingsQuery; library: Library }) {
  const ranking = use_ranking_system();
  const change = (next: Partial<RankingsQuery>) => window.location.replace(rankings_href({ ...query, ...next }));
  if (!ranking.system) return <CatalogStatus error={ranking.error} retry={ranking.retry} message="Loading your rankings." />;
  const system = ranking.system;
  const layout = layout_of(system, query.layout);

  function choose(next: RankingSystem) {
    void ranking.choose(next);
    change({ layout: null });
  }

  const toolbar = <>
    <RankingToolbar system={system} layout={layout} query={query} change={change} choose={choose} />
    {ranking.failure && <p className="ranking-error" role="alert">{ranking.failure}</p>}
  </>;

  if (system === 'stars') return <StarsRanking key={query.kind} query={query} layout={layout} library={library} toolbar={toolbar} change={change} />;
  return <div className="rankings-main">
    {toolbar}
    {layout === 'duel'
      ? <DuelScreen key={query.kind} kind={query.kind} />
      : <DuelList kind={query.kind} duel={rankings_href({ ...query, layout: 'duel' })} />}
  </div>;
}

export function RankingsPage({ query, library }: { query: RankingsQuery; library: Library }) {
  return <section className="page page-gutter rankings-page" aria-labelledby="page-title">
    <h1 className="sr-only" id="page-title">Rankings</h1>
    <Ranking query={query} library={library} />
  </section>;
}
