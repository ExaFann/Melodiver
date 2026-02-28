export interface Track {
  id: string;
  title: string;
  artist: string;
  url: string;
  duration?: number;
  genre?: string;
  album?: string;
  coverArt?: string;
  isDemo?: boolean;
  file?: File;
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
