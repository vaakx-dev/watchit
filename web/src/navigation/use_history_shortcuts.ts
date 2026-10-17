import { useEffect } from 'react';

const BACK_BUTTON = 3;
const FORWARD_BUTTON = 4;

export function use_history_shortcuts(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    function on_mouse(event: MouseEvent) {
      if (event.button !== BACK_BUTTON && event.button !== FORWARD_BUTTON) return;
      event.preventDefault();
      if (event.button === BACK_BUTTON) history.back(); else history.forward();
    }
    function on_key(event: KeyboardEvent) {
      if (!event.altKey || event.ctrlKey || event.shiftKey || event.metaKey) return;
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      event.preventDefault();
      if (event.key === 'ArrowLeft') history.back(); else history.forward();
    }
    window.addEventListener('mouseup', on_mouse);
    window.addEventListener('keydown', on_key);
    return () => {
      window.removeEventListener('mouseup', on_mouse);
      window.removeEventListener('keydown', on_key);
    };
  }, [enabled]);
}
