import { use_install, type InstallState } from '../pwa/install';

const TEXT: Record<Exclude<InstallState, 'available'>, string> = {
  installed: 'Watchit is installed on this device.',
  desktop: 'You are using the Watchit desktop app.',
  insecure: 'Browsers only install web apps from HTTPS or this PC itself. On your phone, open the Tailscale address above to install Watchit.',
  manual: 'Use your browser menu: Install app or Add to Home Screen (on iPhone, Share, then Add to Home Screen).',
};

export function InstallPanel() {
  const { state, install } = use_install();
  return <div className="remote-install">
    <h3>Install on this device</h3>
    <p>{state === 'available' ? 'Add Watchit to your home screen or app list so it opens in its own window.' : TEXT[state]}</p>
    {state === 'available' && <div className="remote-actions"><button className="button primary" type="button" onClick={() => void install()}>Install Watchit</button></div>}
  </div>;
}
