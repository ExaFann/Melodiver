import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const MIME: Record<string, string> = {
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.flac': 'audio/flac',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.opus': 'audio/opus',
  '.webm': 'audio/webm',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};

/**
 * Serve user-uploaded files (audio, covers, thumbnails) from public/uploads/.
 * Next.js standalone mode does NOT serve files added at runtime to public/,
 * so we need this route handler.
 * Supports HTTP Range requests for audio seeking.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: segments } = await params;
  const filePath = path.join(process.cwd(), 'public', 'uploads', ...segments);

  // Security: prevent path traversal
  const resolved = path.resolve(filePath);
  const base = path.resolve(path.join(process.cwd(), 'public', 'uploads'));
  if (!resolved.startsWith(base)) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  if (!fs.existsSync(resolved)) {
    return new NextResponse('Not found', { status: 404 });
  }

  const stat = fs.statSync(resolved);
  const size = stat.size;
  const ext = path.extname(resolved).toLowerCase();
  const contentType = MIME[ext] || 'application/octet-stream';

  // Handle Range requests (needed for audio seeking in browser)
  const rangeHeader = request.headers.get('range');
  if (rangeHeader) {
    const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
    if (match) {
      const start = parseInt(match[1], 10);
      const end = match[2] ? parseInt(match[2], 10) : Math.min(start + 1024 * 1024, size - 1);
      const chunkSize = end - start + 1;

      const buf = Buffer.alloc(chunkSize);
      const fd = fs.openSync(resolved, 'r');
      fs.readSync(fd, buf, 0, chunkSize, start);
      fs.closeSync(fd);

      return new NextResponse(buf, {
        status: 206,
        headers: {
          'Content-Type': contentType,
          'Content-Range': `bytes ${start}-${end}/${size}`,
          'Content-Length': chunkSize.toString(),
          'Accept-Ranges': 'bytes',
        },
      });
    }
  }

  // Full file response
  const buffer = fs.readFileSync(resolved);
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': contentType,
      'Content-Length': size.toString(),
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
