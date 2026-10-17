import { spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { mkdir } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { createInterface } from 'node:readline';
import { copies_audio } from './browser.ts';
import { video_encoder } from './encoders.ts';
import type { Media } from './probe.ts';
import type { Recipe } from './recipe.ts';
import { SEGMENT_SECONDS, type Segment } from './segments.ts';

export type RunEvents = { segment: [index: number, file: string]; exit: [] };

export type Run = {
  first: number;
  directory: string;
  latest: number;
  exited: boolean;
  stopped: boolean;
  events: EventEmitter<RunEvents>;
  stop(): void;
};

const ENDED = /segment:'(.+)' count:\d+ ended/;

function seconds(value: number): string {
  return value.toFixed(3);
}

async function video_args({ media, copy_video }: Recipe): Promise<string[]> {
  if (!media.video) return [];
  const map = ['-map', `0:${media.video.index}`];
  if (copy_video) return [...map, '-c:v', 'copy'];
  const encoder = await video_encoder();
  return [...map, '-vf', encoder.filter, '-c:v', encoder.name, ...encoder.options, '-force_key_frames', `expr:gte(t,n_forced*${SEGMENT_SECONDS})`];
}

function audio_args(media: Media): string[] {
  if (!media.audio) return [];
  const map = ['-map', `0:${media.audio.index}`];
  if (copies_audio(media.audio)) return [...map, '-c:a', 'copy'];
  return [...map, '-c:a', 'aac', '-ac', '2', '-b:a', '192k'];
}

function cut_args(segments: Segment[] | null, first: number): string[] {
  if (!segments) return ['-segment_time', String(SEGMENT_SECONDS), '-segment_list', 'list.m3u8', '-segment_list_type', 'm3u8'];
  const origin = segments[first]?.start ?? 0;
  const cuts = segments.slice(first + 1).map(segment => seconds(segment.start - origin));
  return cuts.length ? ['-segment_times', cuts.join(','), '-segment_time_delta', '0.05'] : [];
}

function seek_args(media: Media, segments: Segment[] | null, first: number): string[] {
  const start = segments?.[first]?.start ?? media.start;
  return start > media.start ? ['-ss', seconds(start - media.start)] : [];
}

export async function start_run(source_url: string, recipe: Recipe, first: number, directory: string): Promise<Run> {
  const { media, segments } = recipe;
  await mkdir(directory, { recursive: true });
  const args = [
    '-hide_banner', '-nostats', '-loglevel', 'verbose',
    ...seek_args(media, segments, first), '-i', source_url,
    ...await video_args(recipe), ...audio_args(media),
    '-sn', '-dn', '-map_metadata', '-1', '-map_chapters', '-1',
    '-copyts', '-avoid_negative_ts', 'disabled', '-max_muxing_queue_size', '4096',
    '-f', 'segment', '-segment_format', 'mpegts', '-segment_start_number', String(first),
    ...cut_args(segments, first), '-y', '%d.ts',
  ];
  const child = spawn('ffmpeg', args, { cwd: directory, stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true });
  const run: Run = {
    first, directory, latest: first - 1, exited: false, stopped: false, events: new EventEmitter<RunEvents>(),
    stop: () => {
      run.stopped = true;
      child.kill('SIGKILL');
    },
  };
  createInterface({ input: child.stderr }).on('line', line => {
    const ended = ENDED.exec(line)?.[1];
    if (!ended) return;
    const name = basename(ended);
    run.latest = Number.parseInt(name, 10);
    run.events.emit('segment', run.latest, join(directory, name));
  });
  child.on('close', () => {
    run.exited = true;
    run.events.emit('exit');
  });
  return run;
}
