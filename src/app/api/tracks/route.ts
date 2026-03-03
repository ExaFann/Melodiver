import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { getAudioDuration } from '@/lib/media';
import fs from 'fs';
import path from 'path';

export async function POST(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const albumId = formData.get('albumId') as string | null;
    const title = (formData.get('title') as string) || '';
    const artist = (formData.get('artist') as string) || '';

    if (!file) {
      return NextResponse.json({ error: 'No audio file uploaded' }, { status: 400 });
    }
    if (!albumId) {
      return NextResponse.json({ error: 'Album ID is required' }, { status: 400 });
    }

    // Verify album belongs to user
    const db = getDb();
    const album = db.prepare(
      'SELECT id FROM albums WHERE id = ? AND userId = ?'
    ).get(albumId, user.id);

    if (!album) {
      return NextResponse.json({ error: 'Album not found' }, { status: 404 });
    }

    // Save file
    const ext = file.name.split('.').pop() || 'mp3';
    const filename = `${uuidv4()}.${ext}`;
    const filePath = `/uploads/${filename}`;
    const fullPath = path.join(process.cwd(), 'public', 'uploads', filename);

    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(fullPath, buffer);

    // Extract duration via ffprobe
    const duration = await getAudioDuration(fullPath);

    // Get max orderIndex
    const maxOrder = db.prepare(
      'SELECT MAX(orderIndex) as maxIdx FROM tracks WHERE albumId = ?'
    ).get(albumId) as { maxIdx: number | null };

    const orderIndex = (maxOrder?.maxIdx ?? -1) + 1;

    const id = uuidv4();
    const trackTitle = title.trim() || file.name.replace(/\.[^.]+$/, '');

    db.prepare(
      'INSERT INTO tracks (id, albumId, userId, title, artist, filePath, duration, orderIndex, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(id, albumId, user.id, trackTitle, artist.trim(), filePath, duration, orderIndex, new Date().toISOString());

    const track = db.prepare('SELECT * FROM tracks WHERE id = ?').get(id) as Record<string, unknown>;

    return NextResponse.json({
      track: { ...track, isDemo: Boolean(track.isDemo) },
    }, { status: 201 });
  } catch (error) {
    console.error('Upload track error:', error);
    return NextResponse.json({ error: 'Failed to upload track' }, { status: 500 });
  }
}
