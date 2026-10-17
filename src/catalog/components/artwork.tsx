import { useState } from 'react';

function hue(text: string) {
  let value = 0;
  for (const char of text) value = (value * 31 + char.charCodeAt(0)) % 360;
  return value;
}

function Fallback({ label }: { label?: string }) {
  if (!label) return <div className="artwork artwork-fallback" />;
  const tint = hue(label);
  return <div className="artwork artwork-fallback titled" style={{ backgroundColor: `hsl(${tint} 24% 18%)`, color: `hsl(${tint} 30% 86%)` }}>
    <span>{label}</span>
  </div>;
}

function Image({ src, eager, label }: { src: string; eager: boolean; label?: string }) {
  const [failed, set_failed] = useState<string | null>(null);
  if (failed === src) return <Fallback label={label} />;

  return <div className="artwork artwork-frame">
    <img className="artwork-image" src={src} alt="" loading={eager ? 'eager' : 'lazy'}
      fetchPriority={eager ? 'high' : 'auto'} decoding="async" referrerPolicy="no-referrer" onError={() => set_failed(src)} />
  </div>;
}

export function Artwork({ src, eager = false, label }: { src: string; eager?: boolean; label?: string }) {
  return src ? <Image key={src.split('?')[0]} src={src} eager={eager} label={label} /> : <Fallback label={label} />;
}
