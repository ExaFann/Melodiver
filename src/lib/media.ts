import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';

const execFileAsync = promisify(execFile);

const IS_WINDOWS = process.platform === 'win32';

/**
 * Locate the yt-dlp binary.
 * - Docker/Linux: installed globally via pip → 'yt-dlp' on PATH
 * - Windows dev: project-local .venv/Scripts/yt-dlp.exe
 */
function findYtDlp(): string {
  if (!IS_WINDOWS) {
    return 'yt-dlp'; // on PATH in Docker
  }

  // Windows: check project-local venv first
  const venvPath = path.join(process.cwd(), '.venv', 'Scripts', 'yt-dlp.exe');
  if (fs.existsSync(venvPath)) return venvPath;

  // Fallback: check common user pip locations
  const appdata = process.env.APPDATA || '';
  for (const ver of ['Python313', 'Python312', 'Python311']) {
    const p = path.join(appdata, 'Python', ver, 'Scripts', 'yt-dlp.exe');
    if (fs.existsSync(p)) return p;
  }

  return 'yt-dlp';
}

export const YT_DLP_PATH = findYtDlp();

/**
 * Locate ffmpeg/ffprobe directory.
 * - Docker/Linux: installed via apt → on PATH, return ''
 * - Windows: check WinGet install, then fall back to PATH
 */
function findFfmpegDir(): string {
  if (!IS_WINDOWS) {
    return ''; // on PATH in Docker
  }

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

  return '';
}

const FFMPEG_DIR = findFfmpegDir();
const FFPROBE_PATH = FFMPEG_DIR
  ? path.join(FFMPEG_DIR, IS_WINDOWS ? 'ffprobe.exe' : 'ffprobe')
  : 'ffprobe';
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
