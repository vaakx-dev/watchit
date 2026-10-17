import type { ImageError } from './transport.ts';

export type CachedImage = {
  path: string;
  content_type: string;
  stale: boolean;
  error?: ImageError;
};

export type Priority = 'visible' | 'background';

export interface Images {
  register(source_url: string): string;
  get(key: string, priority?: Priority): Promise<CachedImage>;
}
