'use client';

import { useState, useRef, useEffect } from 'react';
import { Music, Trash2, Pencil, Check } from 'lucide-react';
import type { Track } from '@/types/music';

interface DemoTrackListProps {
  tracks: Track[];
  currentTrack: Track | null;
  onSelectTrack: (track: Track) => void;
  onDeleteTrack: (trackId: string) => void;
  onUpdateTrack: (trackId: string, field: 'title' | 'artist', value: string) => void;
  isPlaying: boolean;
}

function formatTime(seconds?: number): string {
  if (seconds == null || isNaN(seconds)) return '—:——';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function EditableField({
  value,
  placeholder,
  onSave,
  className,
}: {
  value: string;
  placeholder: string;
  onSave: (v: string) => void;
  className: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const commit = () => {
    const trimmed = draft.trim();
    onSave(trimmed);
    setEditing(false);
  };

  if (editing) {
    return (
      <span className={`${className} editing`} onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="editable-input"
          value={draft}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') { setDraft(value); setEditing(false); }
          }}
          onBlur={commit}
        />
        <button className="editable-confirm" onMouseDown={commit} title="Confirm">
          <Check size={10} />
        </button>
      </span>
    );
  }

  return (
    <span className={className}>
      <span className="editable-text">{value || placeholder}</span>
      <button
        className="editable-edit-btn"
        onClick={(e) => {
          e.stopPropagation();
          setDraft(value);
          setEditing(true);
        }}
        title="Edit"
      >
        <Pencil size={10} />
      </button>
    </span>
  );
}

export default function DemoTrackList({
  tracks,
  currentTrack,
  onSelectTrack,
  onDeleteTrack,
  onUpdateTrack,
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
              <EditableField
                value={track.title}
                placeholder="Untitled"
                onSave={(v) => onUpdateTrack(track.id, 'title', v || 'Untitled')}
                className="playlist-item-title"
              />
              {track.artist ? (
                <EditableField
                  value={track.artist}
                  placeholder="Add artist"
                  onSave={(v) => onUpdateTrack(track.id, 'artist', v)}
                  className="playlist-item-artist"
                />
              ) : (
                <span
                  className="playlist-item-artist add-artist-hint"
                  onClick={(e) => {
                    e.stopPropagation();
                    onUpdateTrack(track.id, 'artist', ' ');
                  }}
                >
                  + Add artist
                </span>
              )}
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
