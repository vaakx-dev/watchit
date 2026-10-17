import type { ReactNode } from 'react';

export function SectionHeader({ id, title, link, children }: {
  id: string;
  title: string;
  link?: { href: string; label: string };
  children?: ReactNode;
}) {
  return <div className="section-header">
    <h2 id={id}>{title}</h2>
    {(link || children) && <div>{link && <a href={link.href}>{link.label} <span aria-hidden="true">→</span></a>}{children}</div>}
  </div>;
}
