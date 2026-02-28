'use client';

import { Music, Trash2 } from 'lucide-react';
import type { Track } from '@/types/music';

interface DemoTrackListProps {
  tracks: Track[];
  currentTrack: Track | null;
  onSelectTrack: (track: Track) => void;
  onDeleteTrack: (trackId: string) => void;
  isPlaying: boolean;
}

function formatTime(seconds?: number): string {
  if (seconds == null || isNaN(seconds)) return '—:——';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export default function DemoTrackList({
  tracks,
  currentTrack,
  onSelectTrack,
  onDeleteTrack,
  isPlaying,
}: DemoTrackListProps) {
  if (tracks.length === 0) {
    return (
      <div className="playlist-empty">
        <Music size={24} />
        <p>No tracks yet</p>
        <p className="text-muted">Upload audio files to get started</p>
      </div>
    );
  }

  return (
    <div className="playlist-list">
      {tracks.map((track) => {
        const isCurrent = currentTrack?.id === track.id;
        return (
          <div
            key={track.id}
            className={`playlist-item ${isCurrent ? 'active' : ''}`}
            onClick={() => onSelectTrack(track)}
          >
            <div className="playlist-item-icon">
              {isCurrent && isPlaying ? (
                <div className="playing-indicator">
                  <span /><span /><span />
                </div>
              ) : (
                <Music size={16} />
              )}
            </div>
            <div className="playlist-item-info">
              <span className="playlist-item-title">{track.title}</span>
              <span className="playlist-item-artist">{track.artist}</span>
            </div>
            <span className="playlist-item-duration">
              {formatTime(track.duration)}
            </span>
            <button
              className="playlist-item-delete"
              onClick={(e) => {
                e.stopPropagation();
                onDeleteTrack(track.id);
              }}
              title="Remove track"
            >
              <Trash2 size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
