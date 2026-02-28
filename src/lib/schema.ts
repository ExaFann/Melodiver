import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';

export function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      passwordHash TEXT NOT NULL,
      createdAt TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS albums (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      name TEXT NOT NULL,
      coverPath TEXT,
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS tracks (
      id TEXT PRIMARY KEY,
      albumId TEXT NOT NULL,
      userId TEXT NOT NULL,
      title TEXT NOT NULL,
      artist TEXT NOT NULL DEFAULT '',
      filePath TEXT NOT NULL,
      duration REAL,
      coverPath TEXT,
      orderIndex INTEGER NOT NULL DEFAULT 0,
      isDemo INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (albumId) REFERENCES albums(id) ON DELETE CASCADE,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_albums_userId ON albums(userId);
    CREATE INDEX IF NOT EXISTS idx_tracks_albumId ON tracks(albumId);
    CREATE INDEX IF NOT EXISTS idx_tracks_userId ON tracks(userId);
  `);
}

const DEMO_TRACKS = [
  {
    title: 'Aesthetic',
    artist: 'MusicWord',
    filePath: '/demo-music/aesthetic-257038.mp3',
  },
  {
    title: 'Dancing in the Stardust',
    artist: 'FreeSoundServer',
    filePath: '/demo-music/dancing-in-the-stardust-free-music-no-copyright-203603.mp3',
  },
  {
    title: 'Deep House Arcade',
    artist: 'shovellovell02',
    filePath: '/demo-music/deep-house-arcade-155394.mp3',
  },
];

export function seedDemoAlbum(db: Database.Database, userId: string) {
  // Check if user already has the demo album
  const existing = db.prepare(
    'SELECT id FROM albums WHERE userId = ? AND name = ?'
  ).get(userId, 'Demo');

  if (existing) return;

  const albumId = uuidv4();
  const now = new Date().toISOString();

  db.prepare(
    'INSERT INTO albums (id, userId, name, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)'
  ).run(albumId, userId, 'Demo', now, now);

  const insertTrack = db.prepare(
    'INSERT INTO tracks (id, albumId, userId, title, artist, filePath, orderIndex, isDemo, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)'
  );

  DEMO_TRACKS.forEach((track, index) => {
    insertTrack.run(
      uuidv4(),
      albumId,
      userId,
      track.title,
      track.artist,
      track.filePath,
      index,
      now
    );
  });
}
