import { useState } from 'react';
import { ChevronLeft, Trophy } from 'lucide-react';
import { Artwork } from '../../../catalog/components/artwork';
import { CatalogStatus } from '../../../catalog/components/status';
import { kind_label, plural } from '../../../catalog/kinds';
import type { CatalogEntry } from '../../../catalog/types';
import { rankings_href, type RankingsQuery } from '../../../navigation/rankings';
import { EmptyState } from '../../../ui/empty_state';
import { RatingControl } from '../../components/rating';
import type { Library } from '../../use_library';
import { use_unrated } from '../use_unrated';

function caption(value: number | null) {
  return value === null ? 'Tap or drag, half stars allowed' : `${value} · tap or drag, half stars allowed`;
}

function Card({ title, library, next }: { title: CatalogEntry; library: Library; next: () => void }) {
  return <div className="quick-rate-card">
    <a className="quick-rate-poster" href={`#/title/${title.id}`}><Artwork src={title.artwork} label={title.title} eager /></a>
    <h2>{title.title}</h2>
    <p>{[kind_label(title), title.year, 'watched'].filter(Boolean).join(' · ')}</p>
    <RatingControl key={title.id} title={title.title} value={null} caption={caption} commit_on_enter
      on_change={rating => { next(); return library.update(title.id, { rating }); }} />
    <div className="quick-rate-actions">
      <button type="button" className="button secondary" onClick={next}>Skip</button>
      <button type="button" className="button secondary" onClick={() => { next(); void library.update(title.id, { status: null }); }}>Haven’t seen it</button>
    </div>
  </div>;
}

function Session({ titles, query, library }: { titles: readonly CatalogEntry[]; query: RankingsQuery; library: Library }) {
  const [index, set_index] = useState(0);
  const title = titles[index];
  const back = rankings_href(query);

  return <section className="page page-gutter quick-rate" aria-labelledby="quick-rate-title">
    <h1 className="sr-only" id="quick-rate-title">Rate what you’ve watched</h1>
    <div className="quick-rate-bar">
      <a className="back-link" href={back}><ChevronLeft />Rankings</a>
      {title && <span>{index + 1} of {titles.length}</span>}
    </div>
    {title
      ? <Card key={title.id} title={title} library={library} next={() => set_index(value => value + 1)} />
      : <EmptyState icon={Trophy} title="All caught up">
        <p>Every watched {query.kind === 'all' ? 'title' : plural(query.kind)} here has a rating.</p>
        <a className="button primary" href={back}>Back to Rankings</a>
      </EmptyState>}
  </section>;
}

export function QuickRatePage({ query, library }: { query: RankingsQuery; library: Library }) {
  const { titles, error, retry } = use_unrated(query.kind, library, { cache: false });
  const [session, set_session] = useState<readonly CatalogEntry[] | null>(null);
  if (!session && titles) set_session(titles);
  if (!session) return <CatalogStatus error={error} retry={retry} message="Loading what you’ve watched." />;
  return <Session titles={session} query={query} library={library} />;
}
