import { useEffect, useState } from 'react';
import { HttpError } from '../catalog/client';
import { Delete } from 'lucide-react';
import { sign_in } from './api';
import { ProfileAvatar } from './avatar';
import { start_session } from './session';
import { PIN_LENGTH, type Profile } from './types';
import { error_message } from './use_action';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

function countdown(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function use_seconds_until(until: number): number {
  const [now, set_now] = useState(Date.now);
  useEffect(() => {
    if (until <= Date.now()) return;
    const timer = setInterval(() => set_now(Date.now()), 250);
    return () => clearInterval(timer);
  }, [until]);
  return Math.max(0, Math.ceil((until - now) / 1000));
}

export function PinPad({ profile, on_cancel }: { profile: Profile; on_cancel: () => void }) {
  const [digits, set_digits] = useState('');
  const [message, set_message] = useState('');
  const [wrong, set_wrong] = useState(0);
  const [pending, set_pending] = useState(false);
  const [locked_until, set_locked_until] = useState(0);
  const locked_seconds = use_seconds_until(locked_until);
  const disabled = pending || locked_seconds > 0;

  async function submit(pin: string) {
    set_pending(true);
    try {
      start_session(await sign_in(profile.id, pin));
    } catch (cause) {
      set_digits('');
      set_pending(false);
      if (cause instanceof HttpError && cause.status === 429) {
        set_message('');
        set_locked_until(Date.now() + (cause.retry_after ?? 30) * 1000);
        return;
      }
      set_message(error_message(cause));
      if (cause instanceof HttpError && cause.status === 403) set_wrong(count => count + 1);
    }
  }

  function press(digit: string) {
    if (disabled || digits.length === PIN_LENGTH) return;
    const next = digits + digit;
    set_digits(next);
    set_message('');
    if (next.length === PIN_LENGTH) void submit(next);
  }

  function erase() {
    if (!disabled) set_digits(digits.slice(0, -1));
  }

  useEffect(() => {
    function key(event: KeyboardEvent) {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (/^\d$/.test(event.key)) press(event.key);
      else if (event.key === 'Backspace') erase();
      else if (event.key === 'Escape') on_cancel();
      else return;
      event.preventDefault();
    }
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  });

  return <section className="pin-pad" aria-labelledby="pin-title">
    <ProfileAvatar profile={profile} />
    <h1 id="pin-title">{profile.name}</h1>
    <div key={wrong} className={`pin-dots${wrong ? ' wrong' : ''}`} role="img" aria-label={`PIN, ${digits.length} of ${PIN_LENGTH} digits entered`}>
      {Array.from({ length: PIN_LENGTH }, (_, index) => <span key={index} className={index < digits.length ? 'filled' : undefined} />)}
    </div>
    <p className={`pin-message${locked_seconds ? ' locked' : ''}`} role="alert">
      {locked_seconds ? `Too many wrong PINs. Try again in ${countdown(locked_seconds)}.` : message || 'Enter PIN'}
    </p>
    <div className="pin-keys">
      {KEYS.map(digit => <button key={digit} type="button" className="pin-key" disabled={disabled} onClick={() => press(digit)}>{digit}</button>)}
      <button type="button" className="pin-key pin-key-text" onClick={on_cancel}>Cancel</button>
      <button type="button" className="pin-key" disabled={disabled} onClick={() => press('0')}>0</button>
      <button type="button" className="pin-key pin-key-text" disabled={disabled || !digits} onClick={erase} aria-label="Delete last digit">
        <Delete />
      </button>
    </div>
  </section>;
}
