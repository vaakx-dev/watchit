import { useState } from 'react';
import { Download, RefreshCw } from 'lucide-react';
import { SettingRow } from '../controls/setting_row';
import { check_for_updates, install_update } from './updates';

type State =
  | { step: 'idle' | 'checking' | 'current' | 'installing' }
  | { step: 'available'; version: string }
  | { step: 'failed'; error: string };

function hint(state: State) {
  if (state.step === 'checking') return 'Checking…';
  if (state.step === 'current') return 'Watchit is up to date.';
  if (state.step === 'available') return `Watchit ${state.version} is ready to install. The app restarts.`;
  if (state.step === 'installing') return 'Downloading the update…';
  if (state.step === 'failed') return state.error;
  return 'Watchit also checks on its own every few hours.';
}

export function UpdateSetting() {
  const [state, set_state] = useState<State>({ step: 'idle' });
  const fail = (cause: unknown) => set_state({ step: 'failed', error: typeof cause === 'string' ? cause : 'Could not reach GitHub. Try again later.' });

  function check() {
    set_state({ step: 'checking' });
    check_for_updates().then(version => set_state(version ? { step: 'available', version } : { step: 'current' })).catch(fail);
  }

  function install() {
    set_state({ step: 'installing' });
    install_update().catch(fail);
  }

  const busy = state.step === 'checking' || state.step === 'installing';
  return <SettingRow label="Updates" hint={hint(state)} error={state.step === 'failed' ? state.error : undefined}>
    {state.step === 'available'
      ? <button type="button" className="button primary small" onClick={install}><Download />Install {state.version}</button>
      : <button type="button" className="button secondary small" disabled={busy} onClick={check}><RefreshCw />Check for updates</button>}
  </SettingRow>;
}
