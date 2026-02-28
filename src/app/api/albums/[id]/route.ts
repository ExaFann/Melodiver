import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import fs from 'fs';
import path from 'path';

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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const db = getDb();

  const album = db.prepare(
    'SELECT * FROM albums WHERE id = ? AND userId = ?'
  ).get(id, user.id) as AlbumRow | undefined;

  if (!album) {
    return NextResponse.json({ error: 'Album not found' }, { status: 404 });
  }

  const tracks = db.prepare(
    'SELECT * FROM tracks WHERE albumId = ? ORDER BY orderIndex ASC'
  ).all(id) as TrackRow[];

  return NextResponse.json({
    album: {
      ...album,
      tracks: tracks.map((t) => ({ ...t, isDemo: Boolean(t.isDemo) })),
    },
  });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const { name } = await request.json();

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Album name is required' }, { status: 400 });
    }

    const db = getDb();
    const album = db.prepare(
      'SELECT id FROM albums WHERE id = ? AND userId = ?'
    ).get(id, user.id) as AlbumRow | undefined;

    if (!album) {
      return NextResponse.json({ error: 'Album not found' }, { status: 404 });
    }

    const now = new Date().toISOString();
    db.prepare(
      'UPDATE albums SET name = ?, updatedAt = ? WHERE id = ?'
    ).run(name.trim(), now, id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Update album error:', error);
    return NextResponse.json({ error: 'Failed to update album' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const db = getDb();

  const album = db.prepare(
    'SELECT * FROM albums WHERE id = ? AND userId = ?'
  ).get(id, user.id) as AlbumRow | undefined;

  if (!album) {
    return NextResponse.json({ error: 'Album not found' }, { status: 404 });
  }

  // Get tracks to delete their files
  const tracks = db.prepare(
    'SELECT filePath, coverPath, isDemo FROM tracks WHERE albumId = ?'
  ).all(id) as TrackRow[];

  // Delete uploaded files (skip demo files)
  for (const track of tracks) {
    if (!track.isDemo && track.filePath.startsWith('/uploads/')) {
      const fullPath = path.join(process.cwd(), 'public', track.filePath);
      try { fs.unlinkSync(fullPath); } catch { /* file may not exist */ }
    }
    if (track.coverPath) {
      const coverFullPath = path.join(process.cwd(), 'public', track.coverPath);
      try { fs.unlinkSync(coverFullPath); } catch { /* ignore */ }
    }
  }

  // Delete album cover
  if (album.coverPath) {
    const coverFullPath = path.join(process.cwd(), 'public', album.coverPath);
    try { fs.unlinkSync(coverFullPath); } catch { /* ignore */ }
  }

  // CASCADE will delete tracks
  db.prepare('DELETE FROM albums WHERE id = ?').run(id);

  return NextResponse.json({ success: true });
}
