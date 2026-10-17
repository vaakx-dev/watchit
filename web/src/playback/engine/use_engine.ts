import { useEffect, useState, useSyncExternalStore, type RefObject } from 'react';
import { create_browser_engine } from './browser_engine';
import { desktop } from './mpv_bridge';
import { create_mpv_engine } from './mpv_engine';
import { INITIAL_STATE, type Engine } from './types';

const idle = () => () => undefined;

export function use_engine(video: RefObject<HTMLVideoElement | null>) {
  const [engine, set_engine] = useState<Engine | null>(null);

  useEffect(() => {
    const element = video.current;
    if (!desktop && !element) return;
    const created = desktop ? create_mpv_engine() : create_browser_engine(element!);
    set_engine(created);
    return () => created.destroy();
  }, [video]);

  const state = useSyncExternalStore(engine?.subscribe ?? idle, engine?.state ?? (() => INITIAL_STATE));
  return { engine, state };
}
