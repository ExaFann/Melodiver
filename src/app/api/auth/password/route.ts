import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getAuthUser, verifyPassword, hashPassword } from '@/lib/auth';

export async function PUT(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { currentPassword, newPassword } = body as {
      currentPassword?: string;
      newPassword?: string;
    };

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: 'Current password and new password are required' },
        { status: 400 }
      );
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: 'New password must be at least 6 characters' },
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

    const valid = await verifyPassword(currentPassword, row.passwordHash);
    if (!valid) {
      return NextResponse.json(
        { error: 'Current password is incorrect' },
        { status: 403 }
      );
    }

    const newHash = await hashPassword(newPassword);
    db.prepare('UPDATE users SET passwordHash = ? WHERE id = ?').run(
      newHash,
      user.id
    );

    return NextResponse.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Password change error:', error);
    return NextResponse.json(
      { error: 'Failed to change password' },
      { status: 500 }
    );
  }
}
