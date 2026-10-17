import { Download, Gauge, HardDrive, Info, MonitorPlay, Smartphone, Sparkles, Users, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import type { Profile } from '../profiles/types';
import { AboutSection } from './about/about_section';
import { DevicesSection } from './devices/devices_section';
import { DownloadsSection } from './downloads/downloads_section';
import { PlaybackSection } from './playback/playback_section';
import { ProfilesSection } from './profiles/profiles_section';
import { QualitySection } from './quality/quality_section';
import { SpeedSection } from './speed/speed_section';
import { StorageSection } from './storage/storage_section';

export type SettingsContext = { profile: Profile; profiles: Profile[]; on_profiles_changed: () => void };
export type Section = { id: string; label: string; icon: LucideIcon; render: (context: SettingsContext) => ReactNode };
export type SectionGroup = { label: string; sections: Section[] };

export const GROUPS: SectionGroup[] = [
  { label: 'Downloads', sections: [
    { id: 'downloads', label: 'Downloads', icon: Download, render: () => <DownloadsSection /> },
    { id: 'speed', label: 'Speed', icon: Gauge, render: () => <SpeedSection /> },
  ] },
  { label: 'Watching', sections: [
    { id: 'quality', label: 'Quality', icon: Sparkles, render: () => <QualitySection /> },
    { id: 'playback', label: 'Playback', icon: MonitorPlay, render: () => <PlaybackSection /> },
  ] },
  { label: 'This server', sections: [
    { id: 'devices', label: 'Devices', icon: Smartphone, render: () => <DevicesSection /> },
    { id: 'profiles', label: 'Profiles', icon: Users, render: context => <ProfilesSection profile={context.profile} profiles={context.profiles} on_changed={context.on_profiles_changed} /> },
    { id: 'storage', label: 'Storage', icon: HardDrive, render: () => <StorageSection /> },
    { id: 'about', label: 'About', icon: Info, render: () => <AboutSection /> },
  ] },
];

export const SECTIONS = GROUPS.flatMap(group => group.sections);
