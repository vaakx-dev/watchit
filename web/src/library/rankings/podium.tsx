import { Artwork } from '../../catalog/components/artwork';
import type { Rankings } from '../types';
import { Stars } from '../components/stars';

export const PODIUM_SIZE = 3;

export function Podium({ rankings }: { rankings: Rankings }) {
  const top = rankings.tiers.flatMap(tier => tier.items.map(item => ({ item, rating: tier.rating }))).slice(0, PODIUM_SIZE);
  return <ol className="podium" aria-label="Top three">
    {top.map(({ item, rating }) => <li className="podium-place" key={item.title.id} data-rank={item.rank}>
      <a href={`#/title/${item.title.id}`}>
        <span className="podium-poster"><Artwork src={item.title.artwork} label={item.title.title} eager /></span>
        <span className="podium-number">{item.rank}</span>
        <span className="podium-title">{item.title.title}</span>
      </a>
      <Stars value={rating} />
    </li>)}
  </ol>;
}
