'use client';

import { useState, useRef, useEffect } from 'react';
import {
  Music, Trash2, Pencil, Check, ChevronDown, ChevronRight,
  Disc3, Plus, Upload, Image as ImageIcon, X,
} from 'lucide-react';
import type { Album, Track } from '@/types/music';

interface AlbumListProps {
  albums: Album[];
  currentTrack: Track | null;
  isPlaying: boolean;
  onSelectTrack: (track: Track) => void;
  onCreateAlbum: (name: string) => void;
  onUpdateAlbum: (albumId: string, name: string) => void;
  onDeleteAlbum: (albumId: string) => void;
  onUploadAlbumCover: (albumId: string, file: File) => void;
  onUploadTrack: (albumId: string, files: File[]) => void;
  onUpdateTrack: (trackId: string, field: 'title' | 'artist', value: string) => void;
  onDeleteTrack: (trackId: string) => void;
}

function formatTime(seconds?: number): string {
  if (seconds == null || isNaN(seconds)) return '—:——';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/* -------- EditableField (reused from old DemoTrackList) -------- */

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

/* -------- Album Cover -------- */

function AlbumCover({
  coverPath,
  albumName,
  onUploadCover,
}: {
  coverPath?: string | null;
  albumName: string;
  onUploadCover: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div
      className="album-cover"
      onClick={(e) => {
        e.stopPropagation();
        inputRef.current?.click();
      }}
      title="Change cover"
    >
      {coverPath ? (
        <img src={coverPath} alt={albumName} className="album-cover-img" />
      ) : (
        <Disc3 size={24} />
      )}
      <div className="album-cover-overlay">
        <ImageIcon size={14} />
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden-input"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onUploadCover(file);
          e.target.value = '';
        }}
      />
    </div>
  );
}

/* -------- New Album Form -------- */

function NewAlbumForm({ onSubmit, onCancel }: { onSubmit: (name: string) => void; onCancel: () => void }) {
  const [name, setName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = () => {
    if (name.trim()) {
      onSubmit(name.trim());
    }
  };

  return (
    <div className="new-album-form" onClick={(e) => e.stopPropagation()}>
      <input
        ref={inputRef}
        className="new-album-input"
        value={name}
        placeholder="Album name..."
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleSubmit();
          if (e.key === 'Escape') onCancel();
        }}
      />
      <button className="new-album-confirm" onClick={handleSubmit} disabled={!name.trim()}>
        <Check size={14} />
      </button>
      <button className="new-album-cancel" onClick={onCancel}>
        <X size={14} />
      </button>
    </div>
  );
}

/* -------- Track Upload Zone (per album) -------- */

function AlbumUploadZone({ albumId, onUpload }: { albumId: string; onUpload: (albumId: string, files: File[]) => void }) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div
      className={`album-upload-zone ${dragOver ? 'drag-over' : ''}`}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('audio/'));
        if (files.length > 0) onUpload(albumId, files);
      }}
    >
      <Upload size={14} />
      <span>Add tracks</span>
      <input
        ref={inputRef}
        type="file"
        accept="audio/*"
        multiple
        className="hidden-input"
        onChange={(e) => {
          const files = Array.from(e.target.files || []);
          if (files.length > 0) onUpload(albumId, files);
          e.target.value = '';
        }}
      />
    </div>
  );
}

/* -------- Main AlbumList -------- */

export default function AlbumList({
  albums,
  currentTrack,
  isPlaying,
  onSelectTrack,
  onCreateAlbum,
  onUpdateAlbum,
  onDeleteAlbum,
  onUploadAlbumCover,
  onUploadTrack,
  onUpdateTrack,
  onDeleteTrack,
}: AlbumListProps) {
  const [expandedAlbums, setExpandedAlbums] = useState<Set<string>>(() => {
    // Auto-expand all albums initially
    return new Set(albums.map((a) => a.id));
  });
  const [showNewAlbumForm, setShowNewAlbumForm] = useState(false);

  // Auto-expand newly added albums
  useEffect(() => {
    setExpandedAlbums((prev) => {
      const next = new Set(prev);
      albums.forEach((a) => {
        if (!prev.has(a.id)) next.add(a.id); // expand new albums
      });
      return next;
    });
  }, [albums]);

  const toggleExpand = (albumId: string) => {
    setExpandedAlbums((prev) => {
      const next = new Set(prev);
      if (next.has(albumId)) {
        next.delete(albumId);
      } else {
        next.add(albumId);
      }
      return next;
    });
  };

  return (
    <div className="album-list">
      {/* Add Album button */}
      {showNewAlbumForm ? (
        <NewAlbumForm
          onSubmit={(name) => {
            onCreateAlbum(name);
            setShowNewAlbumForm(false);
          }}
          onCancel={() => setShowNewAlbumForm(false)}
        />
      ) : (
        <button className="add-album-btn" onClick={() => setShowNewAlbumForm(true)}>
          <Plus size={14} />
          <span>New Album</span>
        </button>
      )}

      {albums.length === 0 && !showNewAlbumForm && (
        <div className="playlist-empty">
          <Disc3 size={24} />
          <p>No albums yet</p>
          <p className="text-muted">Create an album to get started</p>
        </div>
      )}

      {albums.map((album) => {
        const isExpanded = expandedAlbums.has(album.id);
        const trackCount = album.tracks.length;

        return (
          <div key={album.id} className="album-card">
            {/* Album Header */}
            <div className="album-header" onClick={() => toggleExpand(album.id)}>
              <AlbumCover
                coverPath={album.coverPath}
                albumName={album.name}
                onUploadCover={(file) => onUploadAlbumCover(album.id, file)}
              />
              <div className="album-header-info">
                <EditableField
                  value={album.name}
                  placeholder="Album name"
                  onSave={(v) => onUpdateAlbum(album.id, v || 'Untitled Album')}
                  className="album-name"
                />
                <span className="album-track-count">
                  {trackCount} {trackCount === 1 ? 'track' : 'tracks'}
                </span>
              </div>
              <div className="album-header-actions">
                <button
                  className="album-delete-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`Delete album "${album.name}" and all its tracks?`)) {
                      onDeleteAlbum(album.id);
                    }
                  }}
                  title="Delete album"
                >
                  <Trash2 size={14} />
                </button>
                <span className="album-expand-icon">
                  {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </span>
              </div>
            </div>

            {/* Expanded Track List */}
            {isExpanded && (
              <div className="album-tracks">
                {album.tracks.map((track) => {
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
                          <Music size={14} />
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

                {/* Upload zone inside album */}
                <AlbumUploadZone albumId={album.id} onUpload={onUploadTrack} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
