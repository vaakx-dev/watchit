import { copies_video } from './browser.ts';
import { matroska_keyframes } from './matroska.ts';
import type { Media } from './probe.ts';
import { equal_segments, keyframe_segments, type Segment } from './segments.ts';

export type Recipe = { media: Media; copy_video: boolean; segments: Segment[] | null };

async function keyframes(source_url: string, media: Media): Promise<number[] | null> {
  if (!media.container.includes('matroska')) return null;
  const times = await matroska_keyframes(source_url).catch(() => null);
  return times?.length ? times : null;
}

export async function hls_recipe(source_url: string, media: Media): Promise<Recipe> {
  const copyable = media.video !== null && copies_video(media.video);
  if (media.duration === null) return { media, copy_video: copyable, segments: null };
  const cuts = copyable ? await keyframes(source_url, media) : null;
  if (cuts) return { media, copy_video: true, segments: keyframe_segments(cuts, media.start, media.duration) };
  return { media, copy_video: false, segments: equal_segments(media.start, media.duration) };
}
