import { useRef, useState, type PointerEvent } from 'react';
import { Icon } from '../../ui/icon';
import { at, step } from '../rating';
import type { Rating } from '../types';

export function RatingControl({ value, on_change, disabled = false, title }: {
  value: Rating | null;
  on_change: (value: Rating | null) => Promise<boolean>;
  disabled?: boolean;
  title: string;
}) {
  const [draft, set_draft] = useState<Rating | null | undefined>();
  const dragging = useRef(false);
  const displayed = draft === undefined ? value : draft;

  function point(event: PointerEvent<HTMLDivElement>) {
    const { left, width } = event.currentTarget.getBoundingClientRect();
    return at((event.clientX - left) / width);
  }

  function commit(next: Rating | null) {
    set_draft(undefined);
    if (next !== value) void on_change(next);
  }

  function cancel() {
    if (!dragging.current) return;
    dragging.current = false;
    set_draft(undefined);
  }

  return <div className="rating-control">
    <div className="rating-input" role="slider" tabIndex={disabled ? -1 : 0} aria-label={`Rating for ${title}`}
      aria-valuemin={0} aria-valuemax={5} aria-valuenow={displayed ?? 0}
      aria-valuetext={displayed === null ? 'Not rated' : `${displayed} out of 5 stars`} aria-disabled={disabled}
      title="Rate in half-star steps. Arrow keys adjust; Delete clears."
      onKeyDown={event => {
        if (disabled || dragging.current) return;
        const next = step(value, event.key);
        if (next === undefined) return;
        event.preventDefault();
        void commit(next);
      }}
      onPointerDown={event => {
        if (disabled || !event.isPrimary || event.button !== 0) return;
        event.preventDefault();
        dragging.current = true;
        event.currentTarget.focus({ preventScroll: true });
        event.currentTarget.setPointerCapture(event.pointerId);
        set_draft(point(event));
      }}
      onPointerMove={event => {
        if (dragging.current && event.currentTarget.hasPointerCapture(event.pointerId)) set_draft(point(event));
      }}
      onPointerUp={event => {
        if (!dragging.current || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
        dragging.current = false;
        event.currentTarget.releasePointerCapture(event.pointerId);
        if (disabled) set_draft(undefined);
        else void commit(point(event));
      }}
      onPointerCancel={cancel}
      onLostPointerCapture={cancel}>
      <span className="rating-stars" aria-hidden="true">
        {[0, 1, 2, 3, 4].map(index => <span className="rating-star" key={index}>
          <Icon name="star" className="rating-empty" />
          <span className="rating-fill" style={{ width: `${Math.max(0, Math.min(1, (displayed ?? 0) - index)) * 100}%` }}><Icon name="star" /></span>
        </span>)}
      </span>
    </div>
    {displayed !== null && <span className="rating-value" aria-hidden="true">{displayed}</span>}
  </div>;
}
