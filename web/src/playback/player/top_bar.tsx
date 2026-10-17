import { ChevronLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { episode_code } from '../../catalog/episodes';
import type { Title } from '../../catalog/types';
import { framed } from '../../title_bar/frame';
import { WindowControls } from '../../title_bar/window_controls';

export function back_href(title: Title) {
  return `#/title/${title.series?.id ?? title.id}`;
}

export function TopBar({ title, children }: { title: Title; children?: ReactNode }) {
  const series = title.series;
  return <div className="player-top">
    <a className="player-back" href={back_href(title)} aria-label={`Back to ${series?.title ?? title.title}`} title="Back (Esc)">
      <ChevronLeft />
    </a>
    <div className="player-heading">
      {series && <span className="player-series">{series.title}</span>}
      <h1 id="watch-title">{series ? `${episode_code(title)} · ${title.title}` : title.title}</h1>
    </div>
    {children && <div className="player-top-actions">{children}</div>}
  </div>;
}

export function EmbedBar({ title, children }: { title: Title; children?: ReactNode }) {
  return <div className="embed-bar" data-tauri-drag-region={framed ? 'deep' : undefined}>
    <TopBar title={title}>{children}</TopBar>
    {framed && <WindowControls />}
  </div>;
}
