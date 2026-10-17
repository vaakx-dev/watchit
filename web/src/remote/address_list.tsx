import { useState } from 'react';
import { CopyButton } from './copy_button';
import type { Address } from './types';

function qr_source(svg: string) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function AddressList({ addresses }: { addresses: Address[] }) {
  const ordered = [...addresses].sort((a, b) => Number(b.preferred) - Number(a.preferred));
  const [selected, select] = useState(0);
  const shown = ordered[Math.min(selected, ordered.length - 1)];

  return <div className="remote-addresses">
    <ul className="remote-list" aria-label="Addresses for other devices">
      {ordered.map((address, index) => <li key={address.url} data-selected={address === shown}>
        <div className="remote-address">
          <span className="remote-label">{address.label}{address.secure && <small>HTTPS</small>}</span>
          <a className="remote-url" href={address.url} target="_blank" rel="noreferrer">{address.url}</a>
        </div>
        <div className="remote-address-actions">
          <CopyButton text={address.url} label={address.url} />
          {address.qr && <button className="button secondary small" type="button" aria-pressed={address === shown} onClick={() => select(index)}>QR code</button>}
        </div>
      </li>)}
    </ul>
    {shown?.qr && <figure className="remote-qr">
      <img src={qr_source(shown.qr)} alt={`QR code for ${shown.url}`} width="168" height="168" />
      <figcaption>Scan with a phone camera to open {shown.url}</figcaption>
    </figure>}
  </div>;
}
