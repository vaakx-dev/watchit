import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

export function EmptyState({ icon: Glyph, title, children }: { icon?: LucideIcon; title: string; children?: ReactNode }) {
  return <div className="empty-state">
    {Glyph && <Glyph />}
    <h2>{title}</h2>
    {children}
  </div>;
}
