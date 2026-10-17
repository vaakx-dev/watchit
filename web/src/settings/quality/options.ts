import type { Resolution } from '../../torrents/types';
import type { Stance } from '../../generated/torrents/Stance';

export const RESOLUTIONS: { value: Resolution; label: string }[] = [
  { value: '2160p', label: '4K' },
  { value: '1080p', label: '1080p' },
  { value: '720p', label: '720p' },
  { value: '480p', label: '480p' },
];

export const STANCES: { value: Stance; label: string }[] = [
  { value: 'prefer', label: 'Prefer' },
  { value: 'allow', label: 'Allow' },
  { value: 'avoid', label: 'Avoid' },
];

export const LANGUAGES: { value: string; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Spanish' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'it', label: 'Italian' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'ja', label: 'Japanese' },
  { value: 'ko', label: 'Korean' },
  { value: 'zh', label: 'Chinese' },
  { value: 'hi', label: 'Hindi' },
  { value: 'ru', label: 'Russian' },
];

const BYTES_PER_GB = 1_000_000_000;

export const to_gigabytes = (bytes: number | null) => (bytes === null ? '' : String(Math.round(bytes / BYTES_PER_GB * 10) / 10));

export function to_bytes(text: string): number | null | 'invalid' {
  if (!text.trim()) return null;
  const gigabytes = Number(text);
  return Number.isFinite(gigabytes) && gigabytes > 0 ? Math.round(gigabytes * BYTES_PER_GB) : 'invalid';
}
