import { use_action } from '../profiles/use_action';
import { set_tailscale_sharing } from './api';
import type { RemoteStatus, TailscaleStatus } from './types';

const DOWNLOAD = 'https://tailscale.com/download';
const DNS_PAGE = 'https://login.tailscale.com/admin/dns';

type Props = { status: RemoteStatus; on_changed: (status: RemoteStatus) => void; on_recheck: () => void };

function Guidance({ tailscale }: { tailscale: TailscaleStatus }) {
  switch (tailscale.state) {
    case 'missing':
      return <p>Tailscale is not installed on this PC. <a href={DOWNLOAD} target="_blank" rel="noreferrer">Install Tailscale</a> and sign in to reach Watchit from your phone anywhere, over HTTPS.</p>;
    case 'stopped':
      return <p>Tailscale is installed but not connected. Open Tailscale on this PC and turn it on.</p>;
    case 'needs_login':
      return <p>Sign in to Tailscale on this PC to continue. {tailscale.login_url && <a href={tailscale.login_url} target="_blank" rel="noreferrer">Open the sign-in page</a>}</p>;
    case 'needs_approval':
      return <p>Your tailnet admin has to approve this PC in the Tailscale admin console.</p>;
    case 'connecting':
      return <p>Tailscale is connecting. Check again in a moment.</p>;
    case 'no_https':
      return <p>Your tailnet has no HTTPS certificates yet. In the <a href={DNS_PAGE} target="_blank" rel="noreferrer">Tailscale admin console</a>, turn on MagicDNS and HTTPS Certificates.</p>;
    case 'ready':
      return null;
  }
}

function Sharing({ status, on_changed }: Pick<Props, 'status' | 'on_changed'>) {
  const action = use_action();
  const { tailscale, manage } = status;
  const enabled = tailscale.sharing === 'on';
  if (tailscale.sharing === 'elsewhere') return <p>Another Tailscale Serve setup already uses HTTPS port 443. Turn it off with <code>tailscale serve --https=443 off</code>, then check again.</p>;
  return <>
    <p>{enabled ? <>Watchit is shared on your tailnet at <strong>https://{tailscale.name}</strong>. Only devices on your tailnet can open it.</> : <>Share Watchit at <strong>https://{tailscale.name}</strong> on your tailnet. Only devices on your tailnet can open it, and phones can install the app.</>}</p>
    {tailscale.public && <p className="remote-warning" role="alert">This address is also open to the public internet through Tailscale Funnel. Turn Funnel off in Tailscale if that is not what you want.</p>}
    {manage
      ? <div className="remote-actions">
        <button className={`button ${enabled ? 'secondary' : 'primary'}`} type="button" disabled={action.pending}
          onClick={() => void action.run(() => set_tailscale_sharing(!enabled), on_changed)}>
          {action.pending ? 'Working…' : enabled ? 'Stop sharing' : 'Share over Tailscale'}
        </button>
      </div>
      : <p>Only an admin can change this.</p>}
    <p className="remote-error" role="alert">{action.error}</p>
  </>;
}

export function TailscalePanel({ status, on_changed, on_recheck }: Props) {
  const { tailscale } = status;
  return <div className="remote-tailscale">
    <h3>Away from home with Tailscale</h3>
    <Guidance tailscale={tailscale} />
    {tailscale.state === 'ready' && <Sharing status={status} on_changed={on_changed} />}
    {tailscale.state !== 'ready' && <div className="remote-actions"><button className="button secondary small" type="button" onClick={on_recheck}>Check again</button></div>}
  </div>;
}
