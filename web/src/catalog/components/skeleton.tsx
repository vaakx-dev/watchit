import { useId } from 'react';
import { SectionHeader } from '../../ui/section_header';

export function CardSkeleton() {
  return <div className="title-card" aria-hidden="true">
    <div className="card-image skeleton-block" />
    <span className="skeleton-line skeleton-card-title" />
    <span className="skeleton-line skeleton-card-meta" />
  </div>;
}

export function HeroSkeleton() {
  return <section className="hero skeleton-hero" role="status" aria-label="Loading title">
    <div className="hero-art skeleton-block" aria-hidden="true" />
    <div className="hero-copy" aria-hidden="true">
      <div className="skeleton-heading"><span className="skeleton-line" /><span className="skeleton-line" /></div>
      <span className="skeleton-line skeleton-metadata" />
      <div className="skeleton-synopsis"><span className="skeleton-line" /><span className="skeleton-line" /></div>
      <div className="hero-actions"><span className="skeleton-block skeleton-button" /><span className="skeleton-block skeleton-button" /></div>
    </div>
  </section>;
}

export function ShelfSkeleton({ title }: { title: string }) {
  const id = useId();
  return <section className="shelf" aria-labelledby={id}>
    <SectionHeader id={id} title={title} />
    <div role="status" aria-label={`Loading ${title}`}>
      <div className="shelf-row skeleton-row" aria-hidden="true">{Array.from({ length: 8 }, (_, index) => <CardSkeleton key={index} />)}</div>
    </div>
  </section>;
}

export function GridSkeleton() {
  return <div role="status" aria-label="Loading titles">
    <div className="title-grid" aria-hidden="true">{Array.from({ length: 24 }, (_, index) => <CardSkeleton key={index} />)}</div>
  </div>;
}

export function EpisodeSkeleton() {
  return <div role="status" aria-label="Loading episodes">
    <ol className="episode-rows" aria-hidden="true">{Array.from({ length: 4 }, (_, index) => <li className="episode-row" key={index}>
      <div className="episode-link">
        <div className="episode-still skeleton-block" />
        <div className="episode-copy"><span className="skeleton-line skeleton-episode" /></div>
      </div>
    </li>)}</ol>
  </div>;
}
