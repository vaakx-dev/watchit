import { ChevronRight } from 'lucide-react';
import { Artwork } from '../../catalog/components/artwork';
import type { CatalogEntry } from '../../catalog/types';
import type { Rankings } from '../types';
import { Stars } from './stars';

const UNRATED_PREVIEW = 8;

function Unrated({ titles, rate }: { titles: readonly CatalogEntry[]; rate: string }) {
  return <section className="ranking-tier">
    <div className="tier-header"><h2>Not rated</h2><span>{titles.length}</span></div>
    <a className="tier-strip" href={rate} aria-label={`Rate ${titles.length} watched, not rated`}>
      {titles.slice(0, UNRATED_PREVIEW).map(title => <span className="tier-poster" key={title.id}><Artwork src={title.artwork} label={title.title} /></span>)}
      <span className="tier-more"><ChevronRight /></span>
    </a>
  </section>;
}

export function RankingTiers({ rankings, unrated, rate }: { rankings: Rankings; unrated: readonly CatalogEntry[] | null; rate: string }) {
  return <div className="ranking-tiers">
    {rankings.tiers.map(tier => <section className="ranking-tier" key={tier.rating}>
      <div className="tier-header">
        <h2><Stars value={tier.rating} /></h2>
        <span>{tier.items.length}</span>
      </div>
      <ol className="tier-strip">
        {tier.items.map(item => <li key={item.title.id}>
          <a className="tier-poster" href={`#/title/${item.title.id}`} title={item.title.title} aria-label={`${item.rank}. ${item.title.title}`}>
            <Artwork src={item.title.artwork} label={item.title.title} />
          </a>
        </li>)}
      </ol>
    </section>)}
    {unrated && unrated.length > 0 && <Unrated titles={unrated} rate={rate} />}
  </div>;
}
