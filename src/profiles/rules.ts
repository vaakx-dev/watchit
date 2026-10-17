import type { Profile } from './types';

export function is_only_admin(profile: Profile, profiles: Profile[]): boolean {
  return profile.is_admin && profiles.filter(other => other.is_admin).length === 1;
}
