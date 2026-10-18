import { Artwork } from '../../catalog/components/artwork';

export function Poster({ src, name, href }: { src: string; name: string; href: string }) {
  return <a className="download-poster" href={href} tabIndex={-1} aria-hidden="true"><Artwork src={src} label={name} /></a>;
}
