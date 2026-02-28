import { SignJWT, jwtVerify } from 'jose';
import { NextRequest } from 'next/server';
import { getDb } from './db';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'melodiver-dev-secret-change-in-production'
);

// --- Password hashing with PBKDF2 (Web Crypto) ---

async function deriveKey(password: string, salt: Uint8Array<ArrayBuffer>): Promise<ArrayBuffer> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );

  return crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );
}

function toHex(buffer: ArrayBuffer | Uint8Array<ArrayBuffer>): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function fromHex(hex: string): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await deriveKey(password, salt);
  return `${toHex(salt)}:${toHex(hash)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltHex, hashHex] = stored.split(':');
  const salt = fromHex(saltHex);
  const hash = await deriveKey(password, salt);
  return toHex(hash) === hashHex;
}

// --- JWT ---

export async function createToken(userId: string): Promise<string> {
  return new SignJWT({ userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(JWT_SECRET);
}

export async function verifyToken(token: string): Promise<{ userId: string } | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return { userId: payload.userId as string };
  } catch {
    return null;
  }
}

// --- Auth middleware helper ---

interface UserRow {
  id: string;
  username: string;
  email: string;
}

export async function getAuthUser(request: NextRequest): Promise<UserRow | null> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.substring(7);
  const decoded = await verifyToken(token);
  if (!decoded) return null;

  const db = getDb();
  const user = db.prepare(
    'SELECT id, username, email FROM users WHERE id = ?'
  ).get(decoded.userId) as UserRow | undefined;

  return user || null;
}
