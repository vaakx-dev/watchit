const METAHUB = /^\/(?:poster\/small|background\/(?:medium|large))\/tt\d+\/img$/;
const PATHS: Readonly<Record<string, RegExp>> = {
  'images.metahub.space': METAHUB,
  'live.metahub.space': METAHUB,
  'episodes.metahub.space': /^\/tt\d+\/\d+\/\d+\/w780\.jpg$/,
  'image.tmdb.org': /^\/t\/p\/w780\/[a-zA-Z0-9]+\.jpg$/,
  'm.media-amazon.com': /^\/images\/M\/[a-zA-Z0-9@._,-]+\.(?:jpg|jpeg|png|webp)$/,
};

export function image_url(source: string, base?: string): string {
  const invalid = () => new RangeError('Only approved HTTPS image hosts and paths are allowed');
  if (/[\u0000-\u0020\u007f\\#]/.test(source)) throw invalid();
  const parts = /^(?:https:\/\/([^/?#]+))?([^?#]*)(?:\?[^#]*)?$/i.exec(source);
  if (!parts || (!base && !parts[1])) throw invalid();
  if (!parts[1] && /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(source)) throw invalid();
  if (parts[1] && !Object.hasOwn(PATHS, parts[1].toLowerCase())) throw invalid();
  const path = parts[2]!;
  if (path.startsWith('//') || /%2f|%5c/i.test(path)) throw invalid();
  let decoded: string;
  try { decoded = decodeURIComponent(path); } catch { throw invalid(); }
  if (/[\u0000-\u001f\u007f\\%]/.test(decoded) || decoded.split('/').some(part => part === '.' || part === '..')) throw invalid();
  let url: URL;
  try { url = new URL(source, base); } catch { throw invalid(); }
  if (url.protocol !== 'https:' || url.port || url.username || url.password || !PATHS[url.hostname]?.test(url.pathname)) throw invalid();
  return url.href;
}

export function backdrop_url(source: string): string {
  const url = new URL(image_url(source));
  if (!url.hostname.endsWith('.metahub.space')) return url.href;
  return `https://live.metahub.space${url.pathname.replace('/background/medium/', '/background/large/')}`;
}
