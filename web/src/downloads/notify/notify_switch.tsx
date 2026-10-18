import { useState } from 'react';
import { Bell } from 'lucide-react';
import { set_notify_wanted, use_notify_wanted } from './notify_choice';
import { ask_notify_permission, permission_problem } from './permission';
import './notify.css';

export function NotifySwitch() {
  const wanted = use_notify_wanted();
  const [problem, set_problem] = useState<string | null>(null);

  async function toggle() {
    if (wanted) {
      set_notify_wanted(false);
      return;
    }
    const permission = await ask_notify_permission();
    set_problem(permission_problem(permission));
    set_notify_wanted(permission === 'granted');
  }

  return <div className="notify-switch-group">
    <button type="button" role="switch" className="flag-switch notify-switch" aria-checked={wanted} onClick={() => { void toggle(); }}>
      <Bell /><span>Tell me when it&rsquo;s ready to watch</span><span className="switch" aria-hidden="true" />
    </button>
    {problem && <p className="watch-note" role="alert">{problem}</p>}
  </div>;
}
