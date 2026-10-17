import { useEffect, useRef } from 'react';

const CLICK_DELAY_MS = 200;

export function use_surface_clicks(on_click: () => void, on_double_click: () => void) {
  const timer = useRef(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  return {
    onClick: () => {
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(on_click, CLICK_DELAY_MS);
    },
    onDoubleClick: () => {
      window.clearTimeout(timer.current);
      on_double_click();
    },
  };
}
