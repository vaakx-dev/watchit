import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

export type Stream = { index: number; codec: string; profile: string; pixel_format: string };
export type Media = { container: string; start: number; duration: number | null; video: Stream | null; audio: Stream | null };

type ProbeStream = {
  index: number; codec_type?: string; codec_name?: string; profile?: string; pix_fmt?: string; disposition?: { default?: number; attached_pic?: number };
};
type ProbeOutput = { format?: { format_name?: string; start_time?: string; duration?: string }; streams?: ProbeStream[] };

const run = promisify(execFile);

function seconds(value: string | undefined): number | null {
  const parsed = Number(value);
  return value !== undefined && Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function stream_of(streams: ProbeStream[], type: string): Stream | null {
  const candidates = streams.filter(stream => stream.codec_type === type && !stream.disposition?.attached_pic);
  const chosen = candidates.find(stream => stream.disposition?.default) ?? candidates[0];
  if (!chosen) return null;
  return {
    index: chosen.index,
    codec: chosen.codec_name ?? '',
    profile: chosen.profile ?? '',
    pixel_format: chosen.pix_fmt ?? '',
  };
}

export async function probe(source_url: string): Promise<Media> {
  const { stdout } = await run('ffprobe', ['-v', 'error', '-show_format', '-show_streams', '-of', 'json', source_url], { maxBuffer: 16 * 1024 * 1024 });
  const output = JSON.parse(stdout) as ProbeOutput;
  const streams = output.streams ?? [];
  return {
    container: output.format?.format_name ?? '',
    start: seconds(output.format?.start_time) ?? 0,
    duration: seconds(output.format?.duration),
    video: stream_of(streams, 'video'),
    audio: stream_of(streams, 'audio'),
  };
}
