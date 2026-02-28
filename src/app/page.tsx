'use client';

import { useState, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import {
  Play, Pause, Square, Upload, Volume2, Music, Menu, X, ChevronDown, ChevronUp, LogOut, User,
} from 'lucide-react';
import { useAudioPlayer } from '@/hooks/useAudioPlayer';
import { useAuth } from '@/hooks/useAuth';
import Visualizer from '@/components/Visualizer';
import DemoTrackList from '@/components/DemoTrackList';
import AuthPage from '@/components/AuthPage';
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
  const { user, isLoading, logout } = useAuth();

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

  const [formulaOpen, setFormulaOpen] = useState(false);

  // ─── Formula Descriptions ───
  const transferFormulas: Record<MappingMode, { label: string; formula: string; desc: string }> = {
    linear:      { label: 'Linear',      formula: 'f(E) = E',                         desc: 'Direct 1:1 mapping' },
    exponential: { label: 'Exponential', formula: 'f(E) = E³',                        desc: 'Quiet segments suppressed, peaks amplified' },
    threshold:   { label: 'Threshold',   formula: 'f(E) = E > 0.3 ? 1.0 : 0.0',      desc: 'Binary on/off, rhythmic flicker' },
    harmonic:    { label: 'Harmonic',    formula: 'f(E) = (sin(E·2π) + 1) / 2',       desc: 'Sinusoidal oscillation, wave pulsing' },
    inverse:     { label: 'Inverse',     formula: 'f(E) = 1 − E',                     desc: 'Quiet = bright/large, loud = dim/small' },
  };

  const routingFormulas: Record<ChannelRouting, { size: string; color: string; brightness: string }> = {
    normal:   { size: 'bass',      color: 'mid',      brightness: 'treble' },
    swapped:  { size: 'treble',    color: 'bass',     brightness: 'mid' },
    mono:     { size: 'avg(all)',   color: 'avg(all)', brightness: 'avg(all)' },
    spectral: { size: 'bass',      color: 'mid',      brightness: 'treble' },
  };

  const outputFormulas = [
    { param: 'Particle Size',  formula: '0.01 + sizeEnergy × 0.12' },
    { param: 'Rotation Y',     formula: '0.0005 + sizeEnergy × 0.003' },
    { param: 'Rotation X',     formula: '0.0005 + colorEnergy × 0.0015' },
    { param: 'Hue',            formula: '0.55 + colorEnergy × 0.45' },
    { param: 'Saturation',     formula: '0.6 + brightnessEnergy × 0.3' },
    { param: 'Lightness',      formula: '0.4 + brightnessEnergy × 0.35' },
  ];

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
        artist: '',
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

  // ─── Track Update ───
  const handleUpdateTrack = useCallback((trackId: string, field: 'title' | 'artist', value: string) => {
    setTracks((prev) =>
      prev.map((t) => (t.id === trackId ? { ...t, [field]: value } : t))
    );
    if (currentTrack?.id === trackId) {
      setCurrentTrack((prev) => prev ? { ...prev, [field]: value } : prev);
    }
  }, [currentTrack]);

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
  if (isLoading) {
    return (
      <div className="auth-page">
        <div className="auth-card" style={{ alignItems: 'center' }}>
          <span className="auth-logo">Melodiver</span>
          <p style={{ color: 'var(--text-muted)' }}>Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

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
              {/* User */}
              <div className="auth-user-badge">
                <User size={16} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                <div className="auth-user-info">
                  <div className="auth-user-name">{user.username}</div>
                  <div className="auth-user-email">{user.email}</div>
                </div>
                <button className="auth-logout-btn" onClick={logout} title="Sign out">
                  <LogOut size={12} /> Out
                </button>
              </div>
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
                  onUpdateTrack={handleUpdateTrack}
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

                    {/* Formula Reference */}
                    <div className="control-group">
                      <button
                        className="formula-toggle"
                        onClick={() => setFormulaOpen((o) => !o)}
                      >
                        <span className="control-label">Math Reference</span>
                        {formulaOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>
                      {formulaOpen && (
                        <div className="formula-panel">
                          <div className="formula-section">
                            <span className="formula-section-title">Transfer Function</span>
                            <div className="formula-row highlight">
                              <code>{transferFormulas[particleSettings.mappingMode].formula}</code>
                              <span className="formula-desc">{transferFormulas[particleSettings.mappingMode].desc}</span>
                            </div>
                            <div className="formula-divider" />
                            {Object.entries(transferFormulas).map(([key, v]) => (
                              <div key={key} className={`formula-row ${key === particleSettings.mappingMode ? 'active' : ''}`}>
                                <span className="formula-name">{v.label}</span>
                                <code>{v.formula}</code>
                              </div>
                            ))}
                          </div>

                          <div className="formula-section">
                            <span className="formula-section-title">Channel Routing ({particleSettings.channelRouting})</span>
                            <div className="formula-row">
                              <span className="formula-name">Size ←</span>
                              <code>{routingFormulas[particleSettings.channelRouting].size}</code>
                            </div>
                            <div className="formula-row">
                              <span className="formula-name">Color ←</span>
                              <code>{routingFormulas[particleSettings.channelRouting].color}</code>
                            </div>
                            <div className="formula-row">
                              <span className="formula-name">Brightness ←</span>
                              <code>{routingFormulas[particleSettings.channelRouting].brightness}</code>
                            </div>
                          </div>

                          <div className="formula-section">
                            <span className="formula-section-title">Output Mapping</span>
                            {outputFormulas.map((f) => (
                              <div key={f.param} className="formula-row">
                                <span className="formula-name">{f.param}</span>
                                <code>{f.formula}</code>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
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
