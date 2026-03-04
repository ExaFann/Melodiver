import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { YT_DLP_PATH, getAudioDuration, FFMPEG_LOCATION } from '@/lib/media';
import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execFileAsync = promisify(execFile);

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

// URL validation
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

    // Download audio as MP3 and get metadata in one pass
    const fileId = uuidv4();
    const outputTemplate = path.join(UPLOADS_DIR, `${fileId}.%(ext)s`);

    let metadata: YtDlpMetadata;
    try {
      const ytdlpArgs = [
        '-x',
        '--audio-format', 'mp3',
        '--audio-quality', '0',
        '--no-playlist',
        '--no-warnings',
        '--print-json',
        '-o', outputTemplate,
      ];

      // YouTube-specific: use alternative player clients to avoid bot detection
      // on datacenter IPs (Azure, AWS, etc.)
      if (url.includes('youtube.com') || url.includes('youtu.be')) {
        ytdlpArgs.push(
          '--extractor-args', 'youtube:player_client=web_creator,mediaconnect',
        );
      }

      if (FFMPEG_LOCATION) {
        ytdlpArgs.push('--ffmpeg-location', FFMPEG_LOCATION);
      }

      // Support cookies file for sites that require authentication
      const cookiesPath = path.join(process.cwd(), 'data', 'cookies.txt');
      const cookiesPathAlt = path.join(process.cwd(), 'cookies.txt');
      if (fs.existsSync(cookiesPath)) {
        ytdlpArgs.push('--cookies', cookiesPath);
      } else if (fs.existsSync(cookiesPathAlt)) {
        ytdlpArgs.push('--cookies', cookiesPathAlt);
      }

      ytdlpArgs.push(url);

      const { stdout } = await execFileAsync(YT_DLP_PATH, ytdlpArgs, {
        timeout: 180000,
        maxBuffer: 10 * 1024 * 1024,
      });

      // --print-json outputs JSON; take the last valid JSON line
      const lines = stdout.trim().split('\n');
      let parsed: YtDlpMetadata | null = null;
      for (let i = lines.length - 1; i >= 0; i--) {
        try {
          parsed = JSON.parse(lines[i]);
          break;
        } catch {
          // not JSON, skip
        }
      }
      metadata = parsed || {};
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error('yt-dlp error:', errMsg);

      // Clean up any partial files
      try {
        const files = fs.readdirSync(UPLOADS_DIR);
        for (const f of files) {
          if (f.startsWith(fileId)) {
            fs.unlinkSync(path.join(UPLOADS_DIR, f));
          }
        }
      } catch { /* ignore cleanup errors */ }

      // Detect YouTube bot blocking
      const isYouTubeBotBlock = errMsg.includes('Sign in to confirm') || errMsg.includes('not a bot');
      const errorDetail = isYouTubeBotBlock
        ? 'YouTube requires authentication from this server. Place a cookies.txt file (Netscape format) in the data directory to enable YouTube downloads.'
        : 'Failed to download audio. The URL may be invalid, private, or unsupported.';

      return NextResponse.json(
        { error: errorDetail },
        { status: 422 }
      );
    }

    // Find the produced MP3 file
    const filename = `${fileId}.mp3`;
    const expectedPath = path.join(UPLOADS_DIR, filename);
    let actualFile = expectedPath;

    if (!fs.existsSync(actualFile)) {
      const files = fs.readdirSync(UPLOADS_DIR);
      const match = files.find((f) => f.startsWith(fileId));
      if (match) {
        actualFile = path.join(UPLOADS_DIR, match);
        if (!match.endsWith('.mp3')) {
          fs.renameSync(actualFile, expectedPath);
          actualFile = expectedPath;
        }
      } else {
        return NextResponse.json(
          { error: 'Download completed but audio file not found.' },
          { status: 500 }
        );
      }
    }

    // Get accurate duration via ffprobe, fallback to yt-dlp metadata
    const duration = await getAudioDuration(actualFile) ?? metadata.duration ?? null;

    // Download thumbnail if available
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
      }
    }

    // Create DB record
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
      duration,
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
