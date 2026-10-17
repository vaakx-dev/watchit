import type { ReactNode } from 'react';

type Props = { label: string; shortcut?: string; pressed?: boolean; expanded?: boolean; on_click: () => void; children: ReactNode };

export function PlayerButton({ label, shortcut, pressed, expanded, on_click, children }: Props) {
  return <button type="button" className="player-button" aria-label={label} aria-pressed={pressed} aria-expanded={expanded}
    data-tooltip={shortcut ? `${label} (${shortcut})` : label} onClick={on_click}>{children}</button>;
}
