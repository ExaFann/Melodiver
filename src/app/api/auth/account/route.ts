import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getAuthUser, verifyPassword } from '@/lib/auth';
import fs from 'fs';
import path from 'path';

export async function DELETE(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { password } = body as { password?: string };

    if (!password) {
      return NextResponse.json(
        { error: 'Password is required to delete account' },
        { status: 400 }
      );
    }

    const db = getDb();
    const row = db
      .prepare('SELECT passwordHash FROM users WHERE id = ?')
      .get(user.id) as { passwordHash: string } | undefined;

    if (!row) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const valid = await verifyPassword(password, row.passwordHash);
    if (!valid) {
      return NextResponse.json(
        { error: 'Incorrect password' },
        { status: 403 }
      );
    }

    // Delete user's uploaded files
    const tracks = db
      .prepare('SELECT filePath, coverPath FROM tracks WHERE userId = ?')
      .all(user.id) as Array<{ filePath: string; coverPath: string | null }>;

    const albums = db
      .prepare('SELECT coverPath FROM albums WHERE userId = ?')
      .all(user.id) as Array<{ coverPath: string | null }>;

    const filesToDelete = [
      ...tracks.map((t) => t.filePath),
      ...tracks.map((t) => t.coverPath).filter(Boolean),
      ...albums.map((a) => a.coverPath).filter(Boolean),
    ];

    for (const filePath of filesToDelete) {
      if (filePath && filePath.startsWith('/uploads/')) {
        const fullPath = path.join(process.cwd(), 'public', filePath);
        try {
          if (fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath);
          }
        } catch {
          // Non-fatal: continue cleanup
        }
      }
    }

    // Delete user (cascades to albums and tracks via FK)
    db.prepare('DELETE FROM tracks WHERE userId = ?').run(user.id);
    db.prepare('DELETE FROM albums WHERE userId = ?').run(user.id);
    db.prepare('DELETE FROM users WHERE id = ?').run(user.id);

    return NextResponse.json({ message: 'Account deleted successfully' });
  } catch (error) {
    console.error('Account deletion error:', error);
    return NextResponse.json(
      { error: 'Failed to delete account' },
      { status: 500 }
    );
  }
}
