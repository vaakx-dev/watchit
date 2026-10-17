import type { ReactNode } from 'react';
import { Icon, type IconName } from './icon';

export function EmptyState({ icon, title, children }: { icon?: IconName; title: string; children?: ReactNode }) {
  return <div className="empty-state">
    {icon && <Icon name={icon} />}
    <h2>{title}</h2>
    {children}
  </div>;
}
