import { INITIAL_STATE, type EngineState } from './types';

export function create_state_store() {
  let state = INITIAL_STATE;
  const listeners = new Set<() => void>();
  const notify = () => { for (const listener of listeners) listener(); };
  return {
    state: () => state,
    update(patch: Partial<EngineState>) {
      state = { ...state, ...patch };
      notify();
    },
    reset(...kept: (keyof EngineState)[]) {
      state = { ...INITIAL_STATE, ...Object.fromEntries(kept.map(key => [key, state[key]])) };
      notify();
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };
}
