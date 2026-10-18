import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

export function EmptyState({ icon: Glyph, title, children }: { icon?: LucideIcon; title: string; children?: ReactNode }) {
  return <div className="empty-state">
    {Glyph && <Glyph />}
    <h2>{title}</h2>
    {children}
  </div>;
}
