import { Artwork } from '../../catalog/components/artwork';
import type { CatalogEntry } from '../../catalog/types';

export function RatePrompt({ titles, rate }: { titles: readonly CatalogEntry[]; rate: string }) {
  return <div className="rate-prompt">
    <span className="rate-prompt-stack" aria-hidden="true">
      {titles.slice(0, 3).map(title => <span key={title.id}><Artwork src={title.artwork} label={title.title} /></span>)}
    </span>
    <div>
      <h2>{titles.length} watched, not rated</h2>
      <p>Rate them to fill your rankings</p>
    </div>
    <a className="button primary small" href={rate}>Rate</a>
  </div>;
}
