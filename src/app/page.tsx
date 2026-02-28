'use client';

import { useState, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';
import {
  Play, Pause, Square, Volume2, Music, Menu, X, ChevronDown, ChevronUp, LogOut, User, Settings,
} from 'lucide-react';
import { useAudioPlayer } from '@/hooks/useAudioPlayer';
import { useAuth } from '@/hooks/useAuth';
import Visualizer from '@/components/Visualizer';
import AlbumList from '@/components/AlbumList';
import AuthPage from '@/components/AuthPage';
import UserManagementPanel from '@/components/UserManagementPanel';
import { albumsApi, tracksApi } from '@/hooks/useApi';
import type {
  Album,
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
  const { user, isLoading, logout, updateUser } = useAuth();

  // ─── Albums & Playback ───
  const [albums, setAlbums] = useState<Album[]>([]);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [albumsLoading, setAlbumsLoading] = useState(false);

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
  const [userPanelOpen, setUserPanelOpen] = useState(false);

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
  };

  const outputFormulas = [
    { param: 'Particle Size',  formula: '0.01 + sizeEnergy × 0.12' },
    { param: 'Rotation Y',     formula: '0.0005 + sizeEnergy × 0.003' },
    { param: 'Rotation X',     formula: '0.0005 + colorEnergy × 0.0015' },
    { param: 'Hue',            formula: '0.55 + colorEnergy × 0.45' },
    { param: 'Saturation',     formula: '0.6 + brightnessEnergy × 0.3' },
    { param: 'Lightness',      formula: '0.4 + brightnessEnergy × 0.35' },
  ];

  // ─── Load Albums on Login ───
  useEffect(() => {
    if (!user) {
      setAlbums([]);
      return;
    }
    let cancelled = false;
    const fetchAlbums = async () => {
      setAlbumsLoading(true);
      try {
        const data = await albumsApi.list();
        if (!cancelled) setAlbums(data);
      } catch (err) {
        console.error('Failed to load albums:', err);
      } finally {
        if (!cancelled) setAlbumsLoading(false);
      }
    };
    fetchAlbums();
    return () => { cancelled = true; };
  }, [user]);

  // ─── Album CRUD ───
  const handleCreateAlbum = useCallback(async (name: string) => {
    try {
      const album = await albumsApi.create(name);
      setAlbums((prev) => [...prev, album]);
    } catch (err) {
      console.error('Failed to create album:', err);
    }
  }, []);

  const handleUpdateAlbum = useCallback(async (albumId: string, name: string) => {
    try {
      await albumsApi.update(albumId, { name });
      setAlbums((prev) =>
        prev.map((a) => (a.id === albumId ? { ...a, name } : a))
      );
    } catch (err) {
      console.error('Failed to update album:', err);
    }
  }, []);

  const handleDeleteAlbum = useCallback(async (albumId: string) => {
    try {
      // If currently playing track is in this album, stop playback
      const album = albums.find((a) => a.id === albumId);
      if (album && currentTrack && album.tracks.some((t) => t.id === currentTrack.id)) {
        stopTrack();
        setCurrentTrack(null);
      }
      await albumsApi.delete(albumId);
      setAlbums((prev) => prev.filter((a) => a.id !== albumId));
    } catch (err) {
      console.error('Failed to delete album:', err);
    }
  }, [albums, currentTrack, stopTrack]);

  const handleUploadAlbumCover = useCallback(async (albumId: string, file: File) => {
    try {
      const coverPath = await albumsApi.uploadCover(albumId, file);
      setAlbums((prev) =>
        prev.map((a) => (a.id === albumId ? { ...a, coverPath } : a))
      );
    } catch (err) {
      console.error('Failed to upload cover:', err);
    }
  }, []);

  // ─── Track CRUD ───
  const handleUploadTrack = useCallback(async (albumId: string, files: File[]) => {
    for (const file of files) {
      try {
        const title = file.name.replace(/\.[^/.]+$/, '');
        const track = await tracksApi.create(albumId, file, { title });
        setAlbums((prev) =>
          prev.map((a) =>
            a.id === albumId ? { ...a, tracks: [...a.tracks, track] } : a
          )
        );
      } catch (err) {
        console.error('Failed to upload track:', err);
      }
    }
  }, []);

  const handleUpdateTrack = useCallback(async (trackId: string, field: 'title' | 'artist', value: string) => {
    try {
      await tracksApi.update(trackId, { [field]: value });
      setAlbums((prev) =>
        prev.map((a) => ({
          ...a,
          tracks: a.tracks.map((t) =>
            t.id === trackId ? { ...t, [field]: value } : t
          ),
        }))
      );
      if (currentTrack?.id === trackId) {
        setCurrentTrack((prev) => prev ? { ...prev, [field]: value } : prev);
      }
    } catch (err) {
      console.error('Failed to update track:', err);
    }
  }, [currentTrack]);

  const handleDeleteTrack = useCallback(async (trackId: string) => {
    try {
      await tracksApi.delete(trackId);
      setAlbums((prev) =>
        prev.map((a) => ({
          ...a,
          tracks: a.tracks.filter((t) => t.id !== trackId),
        }))
      );
      if (currentTrack?.id === trackId) {
        stopTrack();
        setCurrentTrack(null);
      }
    } catch (err) {
      console.error('Failed to delete track:', err);
    }
  }, [currentTrack, stopTrack]);

  // ─── URL Import ───
  const handleImportUrl = useCallback(async (albumId: string, url: string) => {
    const track = await tracksApi.importFromUrl(albumId, url);
    setAlbums((prev) =>
      prev.map((a) =>
        a.id === albumId ? { ...a, tracks: [...a.tracks, track] } : a
      )
    );
  }, []);

  // ─── Track Selection ───
  const handleSelectTrack = useCallback(async (track: Track) => {
    if (currentTrack?.id === track.id) {
      if (isPlaying) {
        pauseTrack();
      } else {
        playTrack();
      }
      return;
    }

    setCurrentTrack(track);
    try {
      // Load from filePath (could be /demo-music/... or /uploads/...)
      const dur = await loadTrack(track.filePath);
      // Update duration in albums state
      setAlbums((prev) =>
        prev.map((a) => ({
          ...a,
          tracks: a.tracks.map((t) =>
            t.id === track.id ? { ...t, duration: dur } : t
          ),
        }))
      );
      playTrack();
    } catch (err) {
      console.error('Failed to load track:', err);
    }
  }, [currentTrack, isPlaying, loadTrack, playTrack, pauseTrack]);

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
                <button
                  className="user-manage-btn"
                  onClick={() => setUserPanelOpen(true)}
                  title="Account settings"
                >
                  <Settings size={14} />
                </button>
                <button className="auth-logout-btn" onClick={logout} title="Sign out">
                  <LogOut size={12} /> Out
                </button>
              </div>

              {/* Library (Albums) */}
              <div className="sidebar-section">
                <span className="section-label">Library</span>
                {albumsLoading ? (
                  <div className="playlist-empty">
                    <p className="text-muted">Loading albums...</p>
                  </div>
                ) : (
                  <AlbumList
                    albums={albums}
                    currentTrack={currentTrack}
                    isPlaying={isPlaying}
                    onSelectTrack={handleSelectTrack}
                    onCreateAlbum={handleCreateAlbum}
                    onUpdateAlbum={handleUpdateAlbum}
                    onDeleteAlbum={handleDeleteAlbum}
                    onUploadAlbumCover={handleUploadAlbumCover}
                    onUploadTrack={handleUploadTrack}
                    onImportUrl={handleImportUrl}
                    onUpdateTrack={handleUpdateTrack}
                    onDeleteTrack={handleDeleteTrack}
                  />
                )}
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
                        {(['normal', 'swapped', 'mono'] as ChannelRouting[]).map(
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

      {/* User Management Panel */}
      {userPanelOpen && (
        <UserManagementPanel
          user={user}
          onClose={() => setUserPanelOpen(false)}
          onUserUpdated={(updatedUser) => {
            updateUser(updatedUser);
          }}
          onAccountDeleted={() => {
            logout();
            setUserPanelOpen(false);
          }}
        />
      )}
    </div>
  );
}
