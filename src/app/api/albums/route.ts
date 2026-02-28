import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

interface AlbumRow {
  id: string;
  userId: string;
  name: string;
  coverPath: string | null;
  createdAt: string;
  updatedAt: string;
}

interface TrackRow {
  id: string;
  albumId: string;
  title: string;
  artist: string;
  filePath: string;
  duration: number | null;
  coverPath: string | null;
  orderIndex: number;
  isDemo: number;
  createdAt: string;
}

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getDb();
  const albums = db.prepare(
    'SELECT * FROM albums WHERE userId = ? ORDER BY createdAt ASC'
  ).all(user.id) as AlbumRow[];

  const albumsWithTracks = albums.map((album) => {
    const tracks = db.prepare(
      'SELECT * FROM tracks WHERE albumId = ? ORDER BY orderIndex ASC'
    ).all(album.id) as TrackRow[];

    return {
      ...album,
      tracks: tracks.map((t) => ({
        ...t,
        isDemo: Boolean(t.isDemo),
      })),
    };
  });

  return NextResponse.json({ albums: albumsWithTracks });
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { name } = await request.json();

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Album name is required' }, { status: 400 });
    }

    const db = getDb();
    const id = uuidv4();
    const now = new Date().toISOString();

    db.prepare(
      'INSERT INTO albums (id, userId, name, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)'
    ).run(id, user.id, name.trim(), now, now);

    const album = {
      id,
      userId: user.id,
      name: name.trim(),
      coverPath: null,
      createdAt: now,
      updatedAt: now,
      tracks: [],
    };

    return NextResponse.json({ album }, { status: 201 });
  } catch (error) {
    console.error('Create album error:', error);
    return NextResponse.json({ error: 'Failed to create album' }, { status: 500 });
  }
}
