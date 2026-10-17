export type { AudioTrack as SessionAudioTrack } from '../../generated/playback/AudioTrack';
export type { PlaybackSession } from '../../generated/playback/PlaybackSession';
export type { SourceRef as FileSource } from '../../generated/playback/SourceRef';
export type { SubtitleTrack as SessionSubtitleTrack } from '../../generated/playback/SubtitleTrack';

export type SessionTracks = { audio_track?: number; subtitle_track?: number | null };
