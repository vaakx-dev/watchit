import { ChevronRight } from 'lucide-react';
import { GROUPS } from './sections';

export function SectionNav({ current }: { current: string }) {
  return <nav className="settings-nav" aria-label="Settings sections">
    {GROUPS.map(group => <div key={group.label} className="settings-nav-group">
      <h2>{group.label}</h2>
      <ul>
        {group.sections.map(section => <li key={section.id}>
          <a href={`#/settings/${section.id}`} aria-current={section.id === current ? 'page' : undefined}>
            <section.icon />{section.label}<ChevronRight className="settings-nav-open" />
          </a>
        </li>)}
      </ul>
    </div>)}
  </nav>;
}
