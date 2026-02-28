import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

export async function PUT(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { username, email } = body as { username?: string; email?: string };

    if (!username?.trim() && !email?.trim()) {
      return NextResponse.json(
        { error: 'At least one field (username or email) is required' },
        { status: 400 }
      );
    }

    const db = getDb();

    // Check uniqueness
    if (username?.trim() && username.trim() !== user.username) {
      const existing = db
        .prepare('SELECT id FROM users WHERE username = ? AND id != ?')
        .get(username.trim(), user.id);
      if (existing) {
        return NextResponse.json(
          { error: 'Username already taken' },
          { status: 409 }
        );
      }
    }

    if (email?.trim() && email.trim() !== user.email) {
      const existing = db
        .prepare('SELECT id FROM users WHERE email = ? AND id != ?')
        .get(email.trim(), user.id);
      if (existing) {
        return NextResponse.json(
          { error: 'Email already registered' },
          { status: 409 }
        );
      }
    }

    const updates: string[] = [];
    const params: unknown[] = [];

    if (username?.trim()) {
      updates.push('username = ?');
      params.push(username.trim());
    }

    if (email?.trim()) {
      updates.push('email = ?');
      params.push(email.trim());
    }

    params.push(user.id);

    db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(
      ...params
    );

    const updated = db
      .prepare('SELECT id, username, email FROM users WHERE id = ?')
      .get(user.id) as { id: string; username: string; email: string };

    return NextResponse.json({ user: updated });
  } catch (error) {
    console.error('Profile update error:', error);
    return NextResponse.json(
      { error: 'Failed to update profile' },
      { status: 500 }
    );
  }
}
