import { Icon } from '../../ui/icon';

export function Stars({ value }: { value: number }) {
  return <span className="stars" role="img" aria-label={`${value} out of 5 stars`}>
    {[0, 1, 2, 3, 4].map(index => <span className="rating-star" key={index}>
      <Icon name="star" className="rating-empty" />
      <span className="rating-fill" style={{ width: `${Math.max(0, Math.min(1, value - index)) * 100}%` }}><Icon name="star" /></span>
    </span>)}
  </span>;
}
