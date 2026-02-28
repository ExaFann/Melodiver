import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getDb, seedDemoAlbum } from '@/lib/db';
import { hashPassword, createToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const { username, email, password } = await request.json();

    // Validation
    if (!username || !email || !password) {
      return NextResponse.json(
        { error: 'Username, email, and password are required' },
        { status: 400 }
      );
    }
    if (username.length < 2) {
      return NextResponse.json(
        { error: 'Username must be at least 2 characters' },
        { status: 400 }
      );
    }
    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      );
    }

    const db = getDb();

    // Check existing
    const existingEmail = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existingEmail) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 400 });
    }
    const existingUsername = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existingUsername) {
      return NextResponse.json({ error: 'Username already taken' }, { status: 400 });
    }

    const id = uuidv4();
    const passwordHash = await hashPassword(password);

    db.prepare(
      'INSERT INTO users (id, username, email, passwordHash) VALUES (?, ?, ?, ?)'
    ).run(id, username, email, passwordHash);

    // Seed demo album for new user
    seedDemoAlbum(db, id);

    const token = await createToken(id);

    return NextResponse.json({
      token,
      user: { id, username, email },
    });
  } catch (error) {
    console.error('Register error:', error);
    return NextResponse.json({ error: 'Registration failed' }, { status: 500 });
  }
}
