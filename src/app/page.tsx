'use client';

import { useState, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import {
  Play, Pause, Square, Upload, Volume2, Music, Menu, X,
} from 'lucide-react';
import { useAudioPlayer } from '@/hooks/useAudioPlayer';
import Visualizer from '@/components/Visualizer';
import DemoTrackList from '@/components/DemoTrackList';
import type {
  Track,
  VisualizerTab,
  WaveformSettings,
  ParticleSettings,
  DrawMode,
  MappingMode,
  ChannelRouting,
} from '@/types/music';

const ParticleVisualizer = dynamic(
  () => import('@/components/ParticleVisualizer'),
  { ssr: false }
);

function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export default function HomePage() {
  // ─── Tracks & Playback ───
  const [tracks, setTracks] = useState<Track[]>([]);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    isPlaying,
    currentTime,
    duration,
    volume,
    loadTrack,
    playTrack,
    pauseTrack,
    stopTrack,
    seekTo,
    setVolume,
    analyserRef,
  } = useAudioPlayer();

  // ─── UI State ───
  const [activeTab, setActiveTab] = useState<VisualizerTab>('waveform');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const [waveformSettings, setWaveformSettings] = useState<WaveformSettings>({
    drawMode: 'line',
    lineThickness: 2,
    trailPersistence: 0.6,
  });

  const [particleSettings, setParticleSettings] = useState<ParticleSettings>({
    mappingMode: 'linear',
    channelRouting: 'normal',
  });

  // ─── File Upload ───
  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newTracks: Track[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const title = file.name.replace(/\.[^/.]+$/, '');
      const track: Track = {
        id: crypto.randomUUID(),
        title,
        artist: 'Unknown',
        url: URL.createObjectURL(file),
        file,
      };
      newTracks.push(track);
    }

    setTracks((prev) => [...prev, ...newTracks]);

    // Auto-select and play the first new track
    const first = newTracks[0];
    setCurrentTrack(first);
    try {
      const dur = await loadTrack(first.file!);
      setTracks((prev) =>
        prev.map((t) => (t.id === first.id ? { ...t, duration: dur } : t))
      );
      playTrack();
    } catch (err) {
      console.error('Failed to load track:', err);
    }

    // Reset input so same file can be re-uploaded
    e.target.value = '';
  }, [loadTrack, playTrack]);

  // ─── Track Selection ───
  const handleSelectTrack = useCallback(async (track: Track) => {
    if (currentTrack?.id === track.id) {
      // Toggle play/pause for current track
      if (isPlaying) {
        pauseTrack();
      } else {
        playTrack();
      }
      return;
    }

    setCurrentTrack(track);
    try {
      const dur = await loadTrack(track.file || track.url);
      setTracks((prev) =>
        prev.map((t) => (t.id === track.id ? { ...t, duration: dur } : t))
      );
      playTrack();
    } catch (err) {
      console.error('Failed to load track:', err);
    }
  }, [currentTrack, isPlaying, loadTrack, playTrack, pauseTrack]);

  // ─── Track Deletion ───
  const handleDeleteTrack = useCallback((trackId: string) => {
    setTracks((prev) => prev.filter((t) => t.id !== trackId));
    if (currentTrack?.id === trackId) {
      stopTrack();
      setCurrentTrack(null);
    }
  }, [currentTrack, stopTrack]);

  // ─── Transport Controls ───
  const handlePlayPause = useCallback(() => {
    if (!currentTrack) return;
    if (isPlaying) {
      pauseTrack();
    } else {
      playTrack();
    }
  }, [currentTrack, isPlaying, playTrack, pauseTrack]);

  const handleStop = useCallback(() => {
    stopTrack();
  }, [stopTrack]);

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    seekTo(parseFloat(e.target.value));
  }, [seekTo]);

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setVolume(parseFloat(e.target.value));
  }, [setVolume]);

  // ─── Render ───
  return (
    <div className="main-layout">
      {/* ── Left: Visualizer ── */}
      <div className="main-content">
        <div className="visualizer-card">
          {/* Header */}
          <div className="visualizer-header">
            <div className="now-playing">
              <Music size={16} />
              <span className="now-playing-title">
                {currentTrack ? currentTrack.title : 'No track loaded'}
              </span>
            </div>
            <div className="tab-group">
              <button
                className={`tab-button ${activeTab === 'waveform' ? 'active' : ''}`}
                onClick={() => setActiveTab('waveform')}
              >
                Waveform
              </button>
              <button
                className={`tab-button ${activeTab === 'particles' ? 'active' : ''}`}
                onClick={() => setActiveTab('particles')}
              >
                Particles
              </button>
            </div>
          </div>

          {/* Visualizer Area */}
          <div className="visualizer-area">
            {activeTab === 'waveform' ? (
              <Visualizer
                analyserNode={analyserRef.current}
                settings={waveformSettings}
              />
            ) : (
              <ParticleVisualizer
                analyserNode={analyserRef.current}
                settings={particleSettings}
              />
            )}
          </div>

          {/* Transport Bar */}
          <div className="transport-bar">
            <button
              className="transport-btn"
              onClick={handlePlayPause}
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <Pause size={16} /> : <Play size={16} />}
            </button>
            <button
              className="transport-btn stop-btn"
              onClick={handleStop}
              title="Stop"
            >
              <Square size={12} />
            </button>

            <div className="progress-group">
              <span className="time-display">{formatTime(currentTime)}</span>
              <input
                type="range"
                className="progress-slider"
                min={0}
                max={duration || 0}
                step={0.1}
                value={currentTime}
                onChange={handleSeek}
              />
              <span className="time-display">{formatTime(duration)}</span>
            </div>

            <div className="volume-group">
              <Volume2 size={16} className="volume-icon" />
              <input
                type="range"
                className="volume-slider"
                min={0}
                max={1}
                step={0.01}
                value={volume}
                onChange={handleVolumeChange}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Right: Sidebar ── */}
      <aside className={`sidebar ${sidebarOpen ? '' : 'collapsed'}`}>
        {sidebarOpen ? (
          <>
            <div className="sidebar-header">
              <span className="sidebar-title">Melodiver</span>
              <button
                className="sidebar-close"
                onClick={() => setSidebarOpen(false)}
                title="Close sidebar"
              >
                <X size={16} />
              </button>
            </div>
            <div className="sidebar-content">
              {/* Upload */}
              <div className="sidebar-section">
                <span className="section-label">Upload</span>
                <div
                  className="upload-zone"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload size={20} />
                  <p>Click to upload audio</p>
                  <span className="upload-hint">MP3, WAV, OGG, FLAC</span>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="audio/*"
                  multiple
                  className="upload-input"
                  onChange={handleFileUpload}
                />
              </div>

              {/* Playlist */}
              <div className="sidebar-section">
                <span className="section-label">Playlist</span>
                <DemoTrackList
                  tracks={tracks}
                  currentTrack={currentTrack}
                  onSelectTrack={handleSelectTrack}
                  onDeleteTrack={handleDeleteTrack}
                  isPlaying={isPlaying}
                />
              </div>

              {/* Visual Mapping */}
              <div className="sidebar-section">
                <span className="section-label">Visual Mapping</span>

                {activeTab === 'waveform' ? (
                  <>
                    {/* Draw Mode */}
                    <div className="control-group">
                      <span className="control-label">Draw Mode</span>
                      <div className="button-group">
                        {(['line', 'mirror', 'bars'] as DrawMode[]).map((mode) => (
                          <button
                            key={mode}
                            className={`control-button ${waveformSettings.drawMode === mode ? 'active' : ''}`}
                            onClick={() =>
                              setWaveformSettings((s) => ({ ...s, drawMode: mode }))
                            }
                          >
                            {mode.charAt(0).toUpperCase() + mode.slice(1)}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Line Thickness */}
                    <div className="control-group">
                      <div className="slider-group">
                        <div className="slider-header">
                          <span className="control-label">Line Thickness</span>
                          <span className="slider-value">{waveformSettings.lineThickness.toFixed(1)}</span>
                        </div>
                        <input
                          type="range"
                          className="control-slider"
                          min={0.5}
                          max={4}
                          step={0.1}
                          value={waveformSettings.lineThickness}
                          onChange={(e) =>
                            setWaveformSettings((s) => ({
                              ...s,
                              lineThickness: parseFloat(e.target.value),
                            }))
                          }
                        />
                      </div>
                    </div>

                    {/* Trail Persistence */}
                    <div className="control-group">
                      <div className="slider-group">
                        <div className="slider-header">
                          <span className="control-label">Trail Persistence</span>
                          <span className="slider-value">{waveformSettings.trailPersistence.toFixed(2)}</span>
                        </div>
                        <input
                          type="range"
                          className="control-slider"
                          min={0.4}
                          max={1}
                          step={0.01}
                          value={waveformSettings.trailPersistence}
                          onChange={(e) =>
                            setWaveformSettings((s) => ({
                              ...s,
                              trailPersistence: parseFloat(e.target.value),
                            }))
                          }
                        />
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    {/* Transfer Function */}
                    <div className="control-group">
                      <span className="control-label">Transfer Function</span>
                      <div className="button-group">
                        {(['linear', 'exponential', 'threshold', 'harmonic', 'inverse'] as MappingMode[]).map(
                          (mode) => (
                            <button
                              key={mode}
                              className={`control-button ${particleSettings.mappingMode === mode ? 'active' : ''}`}
                              onClick={() =>
                                setParticleSettings((s) => ({ ...s, mappingMode: mode }))
                              }
                            >
                              {mode.charAt(0).toUpperCase() + mode.slice(1)}
                            </button>
                          )
                        )}
                      </div>
                    </div>

                    {/* Channel Routing */}
                    <div className="control-group">
                      <span className="control-label">Channel Routing</span>
                      <div className="button-group">
                        {(['normal', 'swapped', 'mono', 'spectral'] as ChannelRouting[]).map(
                          (routing) => (
                            <button
                              key={routing}
                              className={`control-button ${particleSettings.channelRouting === routing ? 'active' : ''}`}
                              onClick={() =>
                                setParticleSettings((s) => ({
                                  ...s,
                                  channelRouting: routing,
                                }))
                              }
                            >
                              {routing.charAt(0).toUpperCase() + routing.slice(1)}
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="sidebar-collapsed-bar">
            <button
              className="sidebar-toggle"
              onClick={() => setSidebarOpen(true)}
              title="Open sidebar"
            >
              <Menu size={18} />
            </button>
          </div>
        )}
      </aside>
    </div>
  );
}
