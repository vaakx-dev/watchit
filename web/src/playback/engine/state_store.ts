import { INITIAL_STATE, type EngineState } from './types';

export function create_state_store() {
  let state = INITIAL_STATE;
  const listeners = new Set<() => void>();
  return {
    state: () => state,
    update(patch: Partial<EngineState>) {
      state = { ...state, ...patch };
      for (const listener of listeners) listener();
    },
    reset() {
      state = { ...INITIAL_STATE, volume: state.volume, muted: state.muted };
      for (const listener of listeners) listener();
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };
}
