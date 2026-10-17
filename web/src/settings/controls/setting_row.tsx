import type { ReactNode } from 'react';

type Props = { id?: string; label: string; hint?: ReactNode; error?: string; wide?: boolean; children: ReactNode };

export function SettingRow({ id, label, hint, error, wide = false, children }: Props) {
  const hint_id = id ? `${id}-hint` : undefined;
  return <div className="setting-row" data-wide={wide || undefined}>
    <div className="setting-text">
      {id ? <label htmlFor={id}>{label}</label> : <span className="setting-label">{label}</span>}
      {(error || hint) && <p id={hint_id} className="setting-hint" data-invalid={error ? true : undefined}>{error || hint}</p>}
    </div>
    <div className="setting-control">{children}</div>
  </div>;
}
