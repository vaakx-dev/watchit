import { use_resource } from './api';
import type { ContinuePage } from '../library/types';
import type { Library } from '../library/use_library';
import { use_library_refresh } from '../library/use_library_refresh';

export function use_continue(library: Library) {
  const result = use_resource<ContinuePage>('/api/library/continue');
  use_library_refresh(library, result.retry);
  return result;
}
