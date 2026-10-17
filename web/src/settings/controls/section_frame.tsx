import type { ReactNode } from 'react';
import { CatalogStatus } from '../../catalog/components/status';
import { SaveStatus } from './save_status';
import type { Saving } from './use_saving';

type Props = { title: string; intro?: string; saving?: Saving; children: ReactNode };

export function SectionFrame({ title, intro, saving, children }: Props) {
  return <section className="settings-section" aria-labelledby="settings-section-title">
    <header className="settings-section-head">
      <h2 id="settings-section-title">{title}</h2>
      {saving && <SaveStatus saving={saving} />}
    </header>
    {intro && <p className="settings-intro">{intro}</p>}
    {children}
  </section>;
}

export function Loading({ error, retry }: { error: string | null; retry: () => void }) {
  return <CatalogStatus message="Loading settings." error={error ?? undefined} retry={retry} />;
}
