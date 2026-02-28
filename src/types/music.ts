export interface Track {
  id: string;
  albumId: string;
  userId?: string;
  title: string;
  artist: string;
  filePath: string;
  duration?: number;
  coverPath?: string | null;
  orderIndex: number;
  isDemo?: boolean;
  createdAt?: string;
}

export interface Album {
  id: string;
  userId: string;
  name: string;
  coverPath?: string | null;
  tracks: Track[];
  createdAt: string;
  updatedAt: string;
}

export interface ApiUser {
  id: string;
  username: string;
  email: string;
}

export type AudioLoadSource = File | string;

export type DrawMode = 'line' | 'mirror' | 'bars';

export type MappingMode = 'linear' | 'exponential' | 'threshold' | 'harmonic' | 'inverse';

export type ChannelRouting = 'normal' | 'swapped' | 'mono' | 'spectral';

export type VisualizerTab = 'waveform' | 'particles';

export interface WaveformSettings {
  drawMode: DrawMode;
  lineThickness: number;
  trailPersistence: number;
}

export interface ParticleSettings {
  mappingMode: MappingMode;
  channelRouting: ChannelRouting;
}
