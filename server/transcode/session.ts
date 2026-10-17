import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Recipe } from './recipe.ts';
import { start_run, type Run } from './run.ts';
import { SEGMENT_SECONDS } from './segments.ts';

const RESTART_GAP = Math.ceil(24 / SEGMENT_SECONDS);
const IDLE_MS = 60_000;

export type Session = ReturnType<typeof create_session>;

export function create_session(source_url: string, recipe: Recipe, directory: string) {
  const { segments } = recipe;
  const ready = new Map<number, string>();
  let queue: Promise<Run | null> = Promise.resolve(null);
  let runs = 0;
  let last_request = Date.now();

  function covers(run: Run | null, index: number): run is Run {
    if (!run) return false;
    if (segments === null) return !run.stopped;
    return !run.exited && index >= run.first && index <= run.latest + 1 + RESTART_GAP;
  }

  async function replace(previous: Run | null, index: number): Promise<Run> {
    previous?.stop();
    runs += 1;
    const run = await start_run(source_url, recipe, segments ? index : 0, join(directory, `run-${runs}`));
    run.events.on('segment', (segment, file) => ready.set(segment, file));
    return run;
  }

  function ensure(index: number): Promise<Run> {
    const next = queue.then(active => (covers(active, index) ? active : replace(active, index)));
    queue = next.catch(() => null);
    return next;
  }

  function produced(run: Run, index: number): Promise<string> {
    return new Promise((resolve, reject) => {
      const on_segment = (segment: number, file: string) => {
        if (segment === index) finish(() => resolve(file));
      };
      const on_exit = () => finish(() => reject(new Error(`Segment ${index} was not produced.`)));
      const finish = (settle: () => void) => {
        run.events.off('segment', on_segment).off('exit', on_exit);
        settle();
      };
      const file = ready.get(index);
      if (file) return resolve(file);
      if (run.exited) return on_exit();
      run.events.on('segment', on_segment).on('exit', on_exit);
    });
  }

  async function segment(index: number): Promise<string> {
    last_request = Date.now();
    return ready.get(index) ?? produced(await ensure(index), index);
  }

  async function live_playlist(): Promise<string> {
    last_request = Date.now();
    const run = await ensure(0);
    await produced(run, 0);
    return readFile(join(run.directory, 'list.m3u8'), 'utf8');
  }

  async function stop() {
    (await queue)?.stop();
  }

  async function stop_if_idle() {
    if (Date.now() - last_request > IDLE_MS) await stop();
  }

  return { segments, segment, live_playlist, stop, stop_if_idle };
}
