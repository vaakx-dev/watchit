import { Artwork } from '../../catalog/components/artwork';
import type { CatalogEntry } from '../../catalog/types';
import { RatingControl } from '../components/rating';
import type { Rating } from '../types';

const QUEUE_SIZE = 8;

export function RateQueue({ titles, rate }: { titles: readonly CatalogEntry[]; rate: (id: string, rating: Rating | null) => Promise<boolean> }) {
  return <aside className="rate-queue" aria-labelledby="rate-queue-title">
    <h2 id="rate-queue-title">Rate next <span>· {titles.length} left</span></h2>
    <ol>
      {titles.slice(0, QUEUE_SIZE).map(title => <li className="rate-queue-row" key={title.id}>
        <a className="ranked-poster" href={`#/title/${title.id}`} tabIndex={-1} aria-hidden="true"><Artwork src={title.artwork} label={title.title} /></a>
        <div className="ranked-copy">
          <h3><a href={`#/title/${title.id}`}>{title.title}</a></h3>
          <RatingControl title={title.title} value={null} commit_on_enter on_change={rating => rate(title.id, rating)} />
        </div>
      </li>)}
    </ol>
  </aside>;
}
