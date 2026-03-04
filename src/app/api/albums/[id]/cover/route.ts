import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

interface AlbumRow {
  id: string;
  userId: string;
  coverPath: string | null;
}

export async function POST(
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
    'SELECT id, userId, coverPath FROM albums WHERE id = ? AND userId = ?'
  ).get(id, user.id) as AlbumRow | undefined;

  if (!album) {
    return NextResponse.json({ error: 'Album not found' }, { status: 404 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('cover') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No cover file uploaded' }, { status: 400 });
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'File must be an image' }, { status: 400 });
    }

    // Delete old cover if exists
    if (album.coverPath) {
      const oldPath = path.join(process.cwd(), 'public', album.coverPath);
      try { fs.unlinkSync(oldPath); } catch { /* ignore */ }
    }

    // Save new cover
    const ext = file.name.split('.').pop() || 'jpg';
    const filename = `${uuidv4()}.${ext}`;
    const coverPath = `/uploads/covers/${filename}`;
    const coversDir = path.join(process.cwd(), 'public', 'uploads', 'covers');
    const fullPath = path.join(coversDir, filename);

    if (!fs.existsSync(coversDir)) {
      fs.mkdirSync(coversDir, { recursive: true });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(fullPath, buffer);

    // Update database
    const now = new Date().toISOString();
    db.prepare(
      'UPDATE albums SET coverPath = ?, updatedAt = ? WHERE id = ?'
    ).run(coverPath, now, id);

    return NextResponse.json({ coverPath });
  } catch (error) {
    console.error('Upload cover error:', error);
    return NextResponse.json({ error: 'Failed to upload cover' }, { status: 500 });
  }
}
