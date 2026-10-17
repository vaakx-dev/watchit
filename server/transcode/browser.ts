import type { Media, Stream } from './probe.ts';

const MP4_VIDEO = ['h264', 'vp9', 'av1'];
const MP4_AUDIO = ['aac', 'mp3', 'opus', 'flac'];
const WEBM_VIDEO = ['vp8', 'vp9', 'av1'];
const WEBM_AUDIO = ['opus', 'vorbis'];
const EIGHT_BIT_420 = ['yuv420p', 'yuvj420p'];

function plays(stream: Stream | null, codecs: string[]): boolean {
  if (!stream) return true;
  if (!codecs.includes(stream.codec)) return false;
  return stream.codec !== 'h264' || EIGHT_BIT_420.includes(stream.pixel_format);
}

export function plays_directly(media: Media): boolean {
  if (!media.video) return false;
  if (media.container.includes('mp4')) return plays(media.video, MP4_VIDEO) && plays(media.audio, MP4_AUDIO);
  if (media.container.includes('webm')) return plays(media.video, WEBM_VIDEO) && plays(media.audio, WEBM_AUDIO);
  return false;
}

export function copies_video(video: Stream): boolean {
  return video.codec === 'h264' && EIGHT_BIT_420.includes(video.pixel_format);
}

export function copies_audio(audio: Stream): boolean {
  return audio.codec === 'aac';
}
