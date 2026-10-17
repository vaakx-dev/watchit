import type { ReactNode } from 'react';
import { episode_code } from '../../catalog/episodes';
import type { Title } from '../../catalog/types';
import { Icon } from '../../ui/icon';

export function back_href(title: Title) {
  return `#/title/${title.series?.id ?? title.id}`;
}

export function TopBar({ title, children }: { title: Title; children?: ReactNode }) {
  const series = title.series;
  return <div className="player-top">
    <a className="player-button" href={back_href(title)} aria-label={`Back to ${series?.title ?? title.title}`} title="Back (Esc)">
      <Icon name="chevron" className="previous" />
    </a>
    <div className="player-heading">
      {series && <span className="player-series">{series.title}</span>}
      <h1 id="watch-title">{series ? `${episode_code(title)} · ${title.title}` : title.title}</h1>
    </div>
    <div className="player-top-actions">{children}</div>
  </div>;
}
