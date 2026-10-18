import { useState, type FocusEvent } from 'react';
import { Hero } from '../components/hero';
import { HeroSkeleton } from '../components/skeleton';
import { CatalogStatus } from '../components/status';
import { awaiting_items, use_title, use_visible } from '../api';
import { use_rotation } from '../use_rotation';
import { use_trending } from '../use_trending';
import type { TrendingEntry } from '../types';
import { STATUSES } from '../../library/types';
import type { Library } from '../../library/use_library';

const PICKS = 5;

function Reason({ pick }: { pick: TrendingEntry }) {
  return <><strong>#{pick.rank} trending</strong> in {pick.kind === 'movie' ? 'Movies' : 'Series'}</>;
}

function Failure({ error, retry }: { error: string; retry: () => void }) {
  return <div className="home-loading"><CatalogStatus error={error} retry={retry} /></div>;
}

export function TrendingHero({ library }: { library: Library }) {
  const trending = use_trending({ hide: [...STATUSES] });
  const picks = trending.resource.status === 'ready' ? trending.resource.data.items.slice(0, PICKS) : [];
  const [held, set_held] = useState(false);
  const [still] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const visible = use_visible();
  const [index, show] = use_rotation(picks.length, held || still || !visible);
  const pick = picks.at(index);
  const { resource, retry } = use_title(pick?.id);
  use_title(picks.at((index + 1) % picks.length)?.id);

  function release(event: FocusEvent) {
    if (!event.currentTarget.contains(event.relatedTarget)) set_held(false);
  }

  if (trending.resource.status === 'error') return <Failure error={trending.resource.error} retry={trending.retry} />;
  if (awaiting_items(trending.resource)) return <HeroSkeleton />;
  if (!pick) return null;
  if (resource.status === 'error') return <Failure error={resource.error} retry={retry} />;
  if (resource.status !== 'ready') return <HeroSkeleton />;

  return <div className="trending-hero" onPointerEnter={() => set_held(true)} onPointerLeave={() => set_held(false)}
    onFocus={() => set_held(true)} onBlur={release}>
    <Hero key={pick.id} title={resource.data.title} progress={resource.data.progress} reason={<Reason pick={pick} />} library={library}>
      {picks.length > 1 && <div className="hero-picks" role="group" aria-label="Trending picks">
        {picks.map((item, position) => <button type="button" key={item.id} aria-label={item.title} aria-pressed={position === index}
          onClick={() => show(position)} />)}
      </div>}
    </Hero>
  </div>;
}
