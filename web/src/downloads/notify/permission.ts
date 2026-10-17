import { isPermissionGranted, requestPermission } from '@tauri-apps/plugin-notification';
import { desktop } from '../../playback/engine/mpv_bridge';

export type NotifyPermission = 'granted' | 'denied' | 'prompt' | 'unsupported';

export const UNSUPPORTED_REASON = 'Notifications need the desktop app, or a browser on this computer or an https address.';
export const DENIED_REASON = 'Notifications are blocked. Allow them for this site in your browser settings.';

function browser_supported() {
  return window.isSecureContext && 'Notification' in window;
}

export async function notify_permission(): Promise<NotifyPermission> {
  if (desktop) return (await isPermissionGranted()) ? 'granted' : 'denied';
  if (!browser_supported()) return 'unsupported';
  return Notification.permission === 'default' ? 'prompt' : Notification.permission;
}

export async function ask_notify_permission(): Promise<NotifyPermission> {
  if (desktop) return (await requestPermission()) === 'granted' ? 'granted' : 'denied';
  if (!browser_supported()) return 'unsupported';
  const answer = await Notification.requestPermission();
  return answer === 'default' ? 'prompt' : answer;
}

export function permission_problem(permission: NotifyPermission) {
  if (permission === 'unsupported') return UNSUPPORTED_REASON;
  if (permission === 'denied') return DENIED_REASON;
  return null;
}
