import { Artwork } from '../../catalog/components/artwork';
import type { RankedItem, Rankings, RankingTier, Rating } from '../types';
import { count_label } from './kinds';
import { Stars } from './stars';

type Group = { label: string; stars: Rating; items: RankedItem[] };

const TOP: readonly Rating[] = [5, 4.5, 4];

function groups(tiers: readonly RankingTier[]): Group[] {
  const top = TOP.map(rating => ({ label: String(rating), stars: rating, items: tiers.find(tier => tier.rating === rating)?.items ?? [] }));
  const rest: Group = { label: '≤ 3.5', stars: 3.5, items: tiers.filter(tier => tier.rating < 4).flatMap(tier => tier.items) };
  return [...top, rest].filter(group => group.items.length);
}

export function RankingTiers({ rankings }: { rankings: Rankings }) {
  return <div className="ranking-tiers">
    {groups(rankings.tiers).map(group => <section className="ranking-tier" key={group.label}>
      <div className="tier-label">
        <h2>{group.label}<span className="sr-only"> stars</span></h2>
        <span aria-hidden="true"><Stars value={group.stars} /></span>
        <small>{count_label(group.items.length, rankings.kind)}</small>
      </div>
      <ol className="tier-posters">
        {group.items.map(item => <li key={item.title.id} data-favorite={item.entry.favorite}>
          <a href={`#/title/${item.title.id}`} title={item.title.title}
            aria-label={`${item.rank}. ${item.title.title}${item.entry.favorite ? ', favourite' : ''}`}>
            <Artwork src={item.title.artwork} label={item.title.title} />
          </a>
        </li>)}
      </ol>
    </section>)}
  </div>;
}
