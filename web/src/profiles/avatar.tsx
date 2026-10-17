import { useId, type ReactNode } from 'react';
import type { Profile } from './types';

const VIVID = ['#22c55e', '#f5d51d', '#1faaff', '#ee3039', '#ef78b6'];
const INK = '#0a0a0b';
const WHITE = '#f4f4f5';
const EYE = 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z';

const PUPILS: ((color: string) => ReactNode)[] = [
  color => <circle cx="12" cy="12" r="3" fill={color} />,
  color => <path d="M10 8.5l6 3.5-6 3.5z" fill={color} />,
  color => <path d="M9 9h2v6H9zM13 9h2v6h-2z" fill={color} />,
  color => <path d="M12 16.8l-4.4-4.4a2.7 2.7 0 1 1 3.8-3.8l.6.6.6-.6a2.7 2.7 0 1 1 3.8 3.8z" fill={color} />,
  color => <circle cx="12" cy="12" r="3" fill="none" stroke={color} strokeWidth="2" />,
  color => <g transform="translate(1.69 0) skewX(-8)" fill={color}><path d="M8.1 8.8h1.65v6.4H8.1zM11.15 8.8h5.2v1.55h-1.78v4.85h-1.65v-4.85h-1.77z" /></g>,
];

function hash(text: string): number {
  let value = 2166136261;
  for (const character of text) {
    value ^= character.codePointAt(0) ?? 0;
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

function random_source(seed: string) {
  let state = hash(seed);
  function next(): number {
    state = (state + 0x6D2B79F5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  return {
    next,
    range: (low: number, high: number) => Math.round((low + next() * (high - low)) * 10) / 10,
    pick: <T,>(items: readonly T[]): T => items[Math.floor(next() * items.length)]!,
  };
}

function Eyes({ seed }: { seed: string }) {
  const clip = useId();
  const random = random_source(seed);
  const background = random.pick(VIVID);
  const iris = random.pick(VIVID.filter(color => color !== background));
  const look = { x: random.range(-3, 3), y: random.range(-1, 1) };
  const radius = random.range(5.2, 6.6);
  const lid = random.next() < .45 ? random.range(7, 11) : 0;
  const lashes = random.next() < .4;
  const tilt = random.range(-8, 8);
  const pupil = random.pick(PUPILS);
  const glint = Math.round((12 - radius * .45) * 10) / 10;

  return <svg viewBox="0 0 64 64">
    <rect width="64" height="64" fill={background} />
    <defs><clipPath id={clip}><path d={EYE} /></clipPath></defs>
    <g transform={`translate(32 33) rotate(${tilt}) scale(2.15) translate(-12 -12)`}>
      {lashes && <path d="M6 6.2L4.6 3.6M12 4V1.2M18 6.2l1.4-2.6" stroke={INK} strokeWidth="1.4" strokeLinecap="round" />}
      <path d={EYE} fill={WHITE} />
      <g clipPath={`url(#${clip})`}>
        <g transform={`translate(${look.x} ${look.y})`}>
          <circle cx="12" cy="12" r={radius} fill={iris} />
          <g transform={`translate(12 12) scale(${radius / 5.2}) translate(-12 -12)`}>{pupil(INK)}</g>
          <circle cx={glint} cy={glint} r="1" fill="#fff" opacity=".85" />
        </g>
        {lid > 0 && <>
          <rect width="24" height={lid} fill={background} />
          <path d={`M1 ${lid}h22`} stroke={INK} strokeWidth="1.3" />
        </>}
      </g>
      <path d={EYE} fill="none" stroke={INK} strokeWidth="1.5" strokeLinejoin="round" />
    </g>
  </svg>;
}

export function ProfileAvatar({ profile }: { profile: Profile }) {
  return <span className="profile-avatar" aria-hidden="true">
    {profile.avatar.kind === 'image'
      ? <img src={profile.avatar.url} alt="" />
      : <Eyes seed={`${profile.id}:${profile.avatar.seed}`} />}
  </span>;
}
