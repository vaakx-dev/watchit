import { useEffect, useState, type RefObject } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

type Area = { x: number; y: number; width: number; height: number };
type Pointer = 'hover' | 'press' | 'leave';

function place(area: Area | null) {
  void invoke('maximize_button_area', { area }).catch((cause: unknown) => console.error('title bar', cause));
}

function measure(button: HTMLElement): Area {
  const rect = button.getBoundingClientRect();
  const scale = window.devicePixelRatio;
  return { x: rect.left * scale, y: rect.top * scale, width: rect.width * scale, height: rect.height * scale };
}

export function use_snap_button(button: RefObject<HTMLElement | null>, active: boolean) {
  const [pointer, set_pointer] = useState<Pointer>('leave');

  useEffect(() => {
    const unlisten = listen<Pointer>('maximize-button', event => set_pointer(event.payload));
    return () => { void unlisten.then(stop => stop()); };
  }, []);

  useEffect(() => {
    const element = button.current;
    if (!active || !element) return;
    const update = () => place(measure(element));
    const observer = new ResizeObserver(update);
    observer.observe(element);
    observer.observe(document.documentElement);
    update();
    return () => {
      observer.disconnect();
      place(null);
      set_pointer('leave');
    };
  }, [button, active]);

  return pointer;
}
