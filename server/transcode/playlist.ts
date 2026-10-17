import type { Segment } from './segments.ts';

export function vod_playlist(segments: Segment[]): string {
  const target = Math.ceil(Math.max(...segments.map(segment => segment.duration)));
  const lines = ['#EXTM3U', '#EXT-X-VERSION:3', `#EXT-X-TARGETDURATION:${target}`, '#EXT-X-MEDIA-SEQUENCE:0', '#EXT-X-PLAYLIST-TYPE:VOD'];
  segments.forEach((segment, index) => lines.push(`#EXTINF:${segment.duration.toFixed(6)},`, `${index}.ts`));
  lines.push('#EXT-X-ENDLIST', '');
  return lines.join('\n');
}
