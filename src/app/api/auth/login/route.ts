import { NextRequest, NextResponse } from 'next/server';
import { getDb, seedDemoAlbum } from '@/lib/db';
import { verifyPassword, createToken } from '@/lib/auth';

interface UserRow {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
}

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    const db = getDb();
    const user = db.prepare(
      'SELECT id, username, email, passwordHash FROM users WHERE email = ?'
    ).get(email) as UserRow | undefined;

    if (!user) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    // Ensure demo album exists
    seedDemoAlbum(db, user.id);

    const token = await createToken(user.id);

    return NextResponse.json({
      token,
      user: { id: user.id, username: user.username, email: user.email },
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Login failed' }, { status: 500 });
  }
}
