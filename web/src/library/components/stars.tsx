import { Star } from 'lucide-react';

export function Stars({ value }: { value: number }) {
  return <span className="stars" role="img" aria-label={`${value} out of 5 stars`}>
    {[0, 1, 2, 3, 4].map(index => <span className="rating-star" key={index}>
      <Star className="rating-empty" fill="currentColor" />
      <span className="rating-fill" style={{ width: `${Math.max(0, Math.min(1, value - index)) * 100}%` }}><Star fill="currentColor" /></span>
    </span>)}
  </span>;
}
