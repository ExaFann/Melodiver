import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import fs from 'fs';
import path from 'path';

interface TrackRow {
  id: string;
  albumId: string;
  userId: string;
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

  const track = db.prepare(
    'SELECT * FROM tracks WHERE id = ? AND userId = ?'
  ).get(id, user.id) as TrackRow | undefined;

  if (!track) {
    return NextResponse.json({ error: 'Track not found' }, { status: 404 });
  }

  return NextResponse.json({
    track: { ...track, isDemo: Boolean(track.isDemo) },
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
    const { title, artist } = await request.json();

    const db = getDb();
    const track = db.prepare(
      'SELECT id FROM tracks WHERE id = ? AND userId = ?'
    ).get(id, user.id) as TrackRow | undefined;

    if (!track) {
      return NextResponse.json({ error: 'Track not found' }, { status: 404 });
    }

    const updates: string[] = [];
    const values: (string | number)[] = [];

    if (title !== undefined) {
      updates.push('title = ?');
      values.push(title.trim());
    }
    if (artist !== undefined) {
      updates.push('artist = ?');
      values.push(artist.trim());
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    values.push(id);
    db.prepare(`UPDATE tracks SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Update track error:', error);
    return NextResponse.json({ error: 'Failed to update track' }, { status: 500 });
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

  const track = db.prepare(
    'SELECT * FROM tracks WHERE id = ? AND userId = ?'
  ).get(id, user.id) as TrackRow | undefined;

  if (!track) {
    return NextResponse.json({ error: 'Track not found' }, { status: 404 });
  }

  // Delete uploaded file (skip demo tracks)
  if (!track.isDemo && track.filePath.startsWith('/uploads/')) {
    const fullPath = path.join(process.cwd(), 'public', track.filePath);
    try { fs.unlinkSync(fullPath); } catch { /* file may not exist */ }
  }

  db.prepare('DELETE FROM tracks WHERE id = ?').run(id);

  return NextResponse.json({ success: true });
}
