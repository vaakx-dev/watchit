import { useState } from 'react';
import { Artwork } from './artwork';

const METAHUB_LARGE = /^https:\/\/live\.metahub\.space\/background\/large\/(tt\d+)\/img$/;

function medium(id: string) {
  return `https://images.metahub.space/background/medium/${id}/img`;
}

function sources(id: string) {
  return [
    `https://live.metahub.space/background/medium/${id}/img 1280w`,
    `${medium(id)} 1920w`,
    `https://live.metahub.space/background/large/${id}/img 3840w`,
  ].join(', ');
}

export function Backdrop({ src }: { src: string }) {
  const [failed, set_failed] = useState<string | null>(null);
  const id = METAHUB_LARGE.exec(src)?.[1];
  if (!id) return <Artwork src={src} eager />;
  if (failed === src) return <Artwork src={medium(id)} eager />;

  return <div className="artwork artwork-frame">
    <img className="artwork-image" src={src} srcSet={sources(id)} sizes="100vw" alt="" loading="eager"
      fetchPriority="high" decoding="async" referrerPolicy="no-referrer" onError={() => set_failed(src)} />
  </div>;
}
