import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';

const execFileAsync = promisify(execFile);

/**
 * Absolute path to the project-local yt-dlp binary (installed in .venv via uv).
 */
export const YT_DLP_PATH = path.join(process.cwd(), '.venv', 'Scripts', 'yt-dlp.exe');

/**
 * Find ffmpeg/ffprobe directory. Searches:
 * 1. System PATH
 * 2. WinGet install location
 * 3. Common install locations
 */
function findFfmpegDir(): string {
  // Check WinGet packages (Windows)
  const wingetBase = path.join(
    process.env.LOCALAPPDATA || '',
    'Microsoft',
    'WinGet',
    'Packages'
  );

  if (fs.existsSync(wingetBase)) {
    try {
      const entries = fs.readdirSync(wingetBase);
      const ffmpegPkg = entries.find((e) => e.startsWith('Gyan.FFmpeg'));
      if (ffmpegPkg) {
        const pkgDir = path.join(wingetBase, ffmpegPkg);
        // Look for bin/ffprobe.exe inside subdirectories
        const subDirs = fs.readdirSync(pkgDir);
        for (const sub of subDirs) {
          const binDir = path.join(pkgDir, sub, 'bin');
          if (fs.existsSync(path.join(binDir, 'ffprobe.exe'))) {
            return binDir;
          }
        }
      }
    } catch {
      // ignore
    }
  }

  // Fallback: hope it's on PATH
  return '';
}

const FFMPEG_DIR = findFfmpegDir();
const FFPROBE_PATH = FFMPEG_DIR ? path.join(FFMPEG_DIR, 'ffprobe.exe') : 'ffprobe';
export const FFMPEG_LOCATION = FFMPEG_DIR || undefined;

/**
 * Extract audio duration in seconds using ffprobe.
 * Returns null if extraction fails.
 */
export async function getAudioDuration(filePath: string): Promise<number | null> {
  try {
    const { stdout } = await execFileAsync(FFPROBE_PATH, [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_format',
      filePath,
    ], { timeout: 15000 });

    const info = JSON.parse(stdout);
    const dur = parseFloat(info?.format?.duration);
    return isNaN(dur) ? null : dur;
  } catch (err) {
    console.error('ffprobe duration extraction failed:', err);
    return null;
  }
}
