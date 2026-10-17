import { ChevronLeft } from 'lucide-react';
import { SectionNav } from './section_nav';
import { SECTIONS, type SettingsContext } from './sections';
import './settings.css';

export function SettingsPage({ section, ...context }: SettingsContext & { section: string | null }) {
  const current = SECTIONS.find(item => item.id === section) ?? SECTIONS[0]!;
  return <div className="settings page-gutter" data-picked={section !== null}>
    <aside className="settings-side">
      <h1 className="page-title">Settings</h1>
      <SectionNav current={current.id} />
    </aside>
    <div className="settings-content">
      <a className="settings-back button ghost" href="#/settings"><ChevronLeft />Settings</a>
      {current.render(context)}
    </div>
  </div>;
}
