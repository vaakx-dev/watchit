import type { ReactNode } from 'react';

export function SettingGroup({ title, children }: { title?: string; children: ReactNode }) {
  return <div className="setting-group">
    {title && <h3>{title}</h3>}
    <div className="setting-rows">{children}</div>
  </div>;
}
