import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execFileAsync = promisify(execFile);

// Locate the yt-dlp binary — check common locations
function findYtDlp(): string {
  const candidates = [
    // pip --user install on Windows
    path.join(
      process.env.APPDATA || '',
      'Python',
      'Python313',
      'Scripts',
      'yt-dlp.exe'
    ),
    path.join(
      process.env.APPDATA || '',
      'Python',
      'Python312',
      'Scripts',
      'yt-dlp.exe'
    ),
    path.join(
      process.env.APPDATA || '',
      'Python',
      'Python311',
      'Scripts',
      'yt-dlp.exe'
    ),
    // global pip install
    'yt-dlp',
    'yt-dlp.exe',
  ];

  for (const candidate of candidates) {
    try {
      if (candidate.includes(path.sep) && fs.existsSync(candidate)) {
        return candidate;
      }
    } catch {
      // ignore
    }
  }

  // Fallback — hope it's on PATH
  return candidates.find((c) => c.includes('Python313')) || 'yt-dlp';
}

const YT_DLP = findYtDlp();
const UPLOADS_DIR = path.join(process.cwd(), 'public', 'uploads');

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

interface YtDlpMetadata {
  title?: string;
  uploader?: string;
  channel?: string;
  artist?: string;
  track?: string;
  duration?: number;
  thumbnail?: string;
  id?: string;
}

// URL validation — allow YouTube, SoundCloud, Bilibili, Bandcamp, etc.
function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { url, albumId } = body as { url?: string; albumId?: string };

    if (!url || !isValidUrl(url)) {
      return NextResponse.json(
        { error: 'A valid URL is required' },
        { status: 400 }
      );
    }

    if (!albumId) {
      return NextResponse.json(
        { error: 'Album ID is required' },
        { status: 400 }
      );
    }

    // Verify album belongs to user
    const db = getDb();
    const album = db
      .prepare('SELECT id FROM albums WHERE id = ? AND userId = ?')
      .get(albumId, user.id);

    if (!album) {
      return NextResponse.json({ error: 'Album not found' }, { status: 404 });
    }

    // Step 1: Fetch metadata via yt-dlp --print-json (no download)
    let metadata: YtDlpMetadata;
    try {
      const { stdout } = await execFileAsync(YT_DLP, [
        '--no-download',
        '--print-json',
        '--no-warnings',
        '--no-playlist',
        url,
      ], { timeout: 30000, maxBuffer: 10 * 1024 * 1024 });

      metadata = JSON.parse(stdout);
    } catch (err) {
      console.error('yt-dlp metadata error:', err);
      return NextResponse.json(
        { error: 'Failed to fetch media info. The URL may be invalid, private, or unsupported.' },
        { status: 422 }
      );
    }

    // Step 2: Download audio as MP3
    const fileId = uuidv4();
    const filename = `${fileId}.mp3`;
    const outputPath = path.join(UPLOADS_DIR, filename);

    try {
      await execFileAsync(YT_DLP, [
        '-x',
        '--audio-format', 'mp3',
        '--audio-quality', '0',
        '--no-playlist',
        '--no-warnings',
        '-o', outputPath.replace('.mp3', '.%(ext)s'),
        url,
      ], { timeout: 120000, maxBuffer: 10 * 1024 * 1024 });
    } catch (err) {
      console.error('yt-dlp download error:', err);
      return NextResponse.json(
        { error: 'Failed to download audio. Please try again.' },
        { status: 500 }
      );
    }

    // yt-dlp may produce the file with a different extension flow, find the actual file
    let actualFile = outputPath;
    if (!fs.existsSync(actualFile)) {
      // Look for file matching the fileId
      const files = fs.readdirSync(UPLOADS_DIR);
      const match = files.find((f) => f.startsWith(fileId));
      if (match) {
        actualFile = path.join(UPLOADS_DIR, match);
        // Rename to .mp3 if needed
        if (!match.endsWith('.mp3')) {
          const mp3Path = path.join(UPLOADS_DIR, filename);
          fs.renameSync(actualFile, mp3Path);
          actualFile = mp3Path;
        }
      } else {
        return NextResponse.json(
          { error: 'Download completed but audio file not found.' },
          { status: 500 }
        );
      }
    }

    // Step 3: Download thumbnail if available
    let coverPath: string | null = null;
    if (metadata.thumbnail) {
      try {
        const thumbId = uuidv4();
        const thumbFilename = `${thumbId}.jpg`;
        const thumbPath = path.join(UPLOADS_DIR, thumbFilename);

        const thumbResponse = await fetch(metadata.thumbnail);
        if (thumbResponse.ok) {
          const thumbBuffer = Buffer.from(await thumbResponse.arrayBuffer());
          fs.writeFileSync(thumbPath, thumbBuffer);
          coverPath = `/uploads/${thumbFilename}`;
        }
      } catch (err) {
        console.error('Thumbnail download failed (non-fatal):', err);
        // Continue without cover
      }
    }

    // Step 4: Create DB record
    const maxOrder = db
      .prepare('SELECT MAX(orderIndex) as maxIdx FROM tracks WHERE albumId = ?')
      .get(albumId) as { maxIdx: number | null };

    const orderIndex = (maxOrder?.maxIdx ?? -1) + 1;
    const trackId = uuidv4();
    const trackTitle = metadata.track || metadata.title || 'Imported Track';
    const trackArtist =
      metadata.artist || metadata.uploader || metadata.channel || '';

    db.prepare(
      'INSERT INTO tracks (id, albumId, userId, title, artist, filePath, duration, coverPath, orderIndex, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(
      trackId,
      albumId,
      user.id,
      trackTitle,
      trackArtist,
      `/uploads/${filename}`,
      metadata.duration || null,
      coverPath,
      orderIndex,
      new Date().toISOString()
    );

    const track = db
      .prepare('SELECT * FROM tracks WHERE id = ?')
      .get(trackId) as Record<string, unknown>;

    return NextResponse.json(
      {
        track: { ...track, isDemo: Boolean(track.isDemo) },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Import track error:', error);
    return NextResponse.json(
      { error: 'Failed to import track' },
      { status: 500 }
    );
  }
}
