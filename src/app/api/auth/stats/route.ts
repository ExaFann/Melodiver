import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import fs from 'fs';
import path from 'path';

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const db = getDb();

    const albumCount = db
      .prepare('SELECT COUNT(*) as count FROM albums WHERE userId = ?')
      .get(user.id) as { count: number };

    const trackCount = db
      .prepare('SELECT COUNT(*) as count FROM tracks WHERE userId = ?')
      .get(user.id) as { count: number };

    // Calculate storage used
    const tracks = db
      .prepare('SELECT filePath, coverPath FROM tracks WHERE userId = ?')
      .all(user.id) as Array<{ filePath: string; coverPath: string | null }>;

    const albums = db
      .prepare('SELECT coverPath FROM albums WHERE userId = ?')
      .all(user.id) as Array<{ coverPath: string | null }>;

    let storageBytes = 0;
    const allFiles = [
      ...tracks.map((t) => t.filePath),
      ...tracks.map((t) => t.coverPath).filter(Boolean),
      ...albums.map((a) => a.coverPath).filter(Boolean),
    ];

    for (const filePath of allFiles) {
      if (filePath && filePath.startsWith('/uploads/')) {
        const fullPath = path.join(process.cwd(), 'public', filePath);
        try {
          const stat = fs.statSync(fullPath);
          storageBytes += stat.size;
        } catch {
          // file may not exist
        }
      }
    }

    const userRow = db
      .prepare('SELECT createdAt FROM users WHERE id = ?')
      .get(user.id) as { createdAt: string } | undefined;

    return NextResponse.json({
      stats: {
        albumCount: albumCount.count,
        trackCount: trackCount.count,
        storageBytes,
        createdAt: userRow?.createdAt || null,
      },
    });
  } catch (error) {
    console.error('Stats error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}
