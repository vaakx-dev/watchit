export const SESSION_HEADER = 'X-Watchit-Session';
export const PROFILE_NAME_LIMIT = 24;
export const PIN_LENGTH = 4;

export type Avatar = { kind: 'eyes'; seed: number } | { kind: 'image'; url: string };
export type Profile = { id: number; name: string; created_at: string; is_admin: boolean; has_pin: boolean; avatar: Avatar };
export type ProfilePatch = { name?: string; is_admin?: boolean };
export type PinChange = { pin: string | null; current_pin?: string };
export type ProfileSession = { token: string; profile: Profile };
export type SessionState = { profile: Profile | null };
