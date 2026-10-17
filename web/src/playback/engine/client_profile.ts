import { desktop } from './mpv_bridge';

export type ClientProfile = {
  player: 'mpv' | 'browser';
  containers: string[];
  video_codecs: string[];
  audio_codecs: string[];
  hdr: boolean;
  max_height: number;
};

const MPV_PROFILE: ClientProfile = {
  player: 'mpv',
  containers: ['mkv', 'mp4', 'webm', 'avi', 'mpegts'],
  video_codecs: ['h264', 'hevc', 'av1', 'vp9', 'mpeg2video', 'mpeg4'],
  audio_codecs: ['aac', 'mp3', 'opus', 'flac', 'ac3', 'eac3', 'dts', 'truehd'],
  hdr: true,
  max_height: 4320,
};

const VIDEO: Record<string, string> = {
  h264: 'video/mp4; codecs="avc1.640033"',
  hevc: 'video/mp4; codecs="hvc1.2.4.L153.B0"',
  av1: 'video/mp4; codecs="av01.0.13M.10"',
  vp9: 'video/webm; codecs="vp09.00.51.08"',
};

const AUDIO: Record<string, string> = {
  aac: 'audio/mp4; codecs="mp4a.40.2"',
  mp3: 'audio/mpeg',
  opus: 'audio/mp4; codecs="opus"',
  flac: 'audio/mp4; codecs="flac"',
  ac3: 'audio/mp4; codecs="ac-3"',
  eac3: 'audio/mp4; codecs="ec-3"',
  dts: 'audio/mp4; codecs="dtsc"',
};

const HDR_VIDEO = { contentType: VIDEO.hevc!, width: 3840, height: 2160, bitrate: 40_000_000, framerate: 24, hdrMetadataType: 'smpteSt2086', colorGamut: 'rec2020', transferFunction: 'pq' } as const;

function supported(type: string) {
  return typeof MediaSource !== 'undefined' && MediaSource.isTypeSupported(type);
}

async function decodes(video: VideoConfiguration) {
  if (!navigator.mediaCapabilities) return supported(video.contentType);
  try { return (await navigator.mediaCapabilities.decodingInfo({ type: 'media-source', video })).supported; }
  catch { return false; }
}

async function video_codecs() {
  const checks = Object.entries(VIDEO).map(async ([name, type]) => supported(type)
    && await decodes({ contentType: type, width: 1920, height: 1080, bitrate: 10_000_000, framerate: 24 }) ? name : null);
  return (await Promise.all(checks)).filter(name => name !== null);
}

async function max_height(codecs: string[]) {
  const uhd = await Promise.all(codecs.map(name => decodes({ contentType: VIDEO[name]!, width: 3840, height: 2160, bitrate: 40_000_000, framerate: 24 })));
  return uhd.some(Boolean) ? 2160 : 1080;
}

async function hdr(codecs: string[]) {
  if (!codecs.includes('hevc') || !window.matchMedia('(dynamic-range: high)').matches) return false;
  return decodes(HDR_VIDEO);
}

function containers() {
  const probe = document.createElement('video');
  const list = ['mp4'];
  if (supported('video/webm; codecs="vp9"')) list.push('webm');
  if (probe.canPlayType('video/x-matroska') || probe.canPlayType('video/mkv')) list.push('mkv');
  return list;
}

async function browser_profile(): Promise<ClientProfile> {
  const codecs = await video_codecs();
  const [height, high_range] = await Promise.all([max_height(codecs), hdr(codecs)]);
  return {
    player: 'browser',
    containers: containers(),
    video_codecs: codecs,
    audio_codecs: Object.entries(AUDIO).filter(([, type]) => supported(type)).map(([name]) => name),
    hdr: high_range,
    max_height: height,
  };
}

let detected: Promise<ClientProfile> | null = null;

export function client_profile() {
  detected ??= desktop ? Promise.resolve(MPV_PROFILE) : browser_profile();
  return detected;
}
