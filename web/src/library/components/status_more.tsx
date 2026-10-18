import { Ellipsis } from 'lucide-react';
import type { StatusMenuControl } from './use_status_menu';

export function StatusMore({ menu, title }: { menu: StatusMenuControl; title: string }) {
  return <button type="button" className="icon-button ghost small status-more" {...menu.trigger_props}
    aria-label={`${title}: ${menu.label}. Change status`} title="Change status">
    <Ellipsis />
  </button>;
}
