import type { ReactNode } from 'react';

export function Page({ title, children }: { title: string; children: ReactNode }) {
  return <section className="page page-gutter" aria-labelledby="page-title">
    <h1 className="page-title" id="page-title">{title}</h1>
    {children}
  </section>;
}
