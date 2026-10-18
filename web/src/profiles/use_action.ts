import { useState } from 'react';
import { error_message } from '../catalog/client';

export const NO_ANSWER = 'The server did not answer. Try again.';

export function use_action() {
  const [pending, set_pending] = useState(false);
  const [error, set_error] = useState('');

  async function run<T>(operation: () => Promise<T>, after: (result: T) => void) {
    set_pending(true);
    set_error('');
    try {
      const result = await operation();
      set_pending(false);
      after(result);
    } catch (cause) {
      set_error(error_message(cause, NO_ANSWER));
      set_pending(false);
    }
  }

  return { pending, error, set_error, run };
}
