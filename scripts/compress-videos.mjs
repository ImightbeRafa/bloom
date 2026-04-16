// ─── Bloom — Video Compression (Node.js, no system ffmpeg needed) ────────────
// Uses @ffmpeg-installer/ffmpeg to get a bundled ffmpeg binary.
// Converts every .mov in public/images/ to web-optimized .mp4 (H.264).
// Run: node scripts/compress-videos.mjs

import { spawnSync } from 'node:child_process';
import { readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, basename, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ffmpegPath = ffmpegInstaller.path;
const imagesDir = join(__dirname, '..', 'public', 'images');

console.log('\nffmpeg:', ffmpegPath);
console.log('Source dir:', imagesDir, '\n');

const files = readdirSync(imagesDir).filter(f => f.toLowerCase().endsWith('.mov'));

if (!files.length) {
  console.log('No .mov files found.');
  process.exit(0);
}

for (const file of files) {
  const srcPath = join(imagesDir, file);
  const base = basename(file, extname(file));
  const mp4Path = join(imagesDir, `${base}.mp4`);

  const srcSizeMB = (statSync(srcPath).size / 1024 / 1024).toFixed(1);
  console.log(`→ ${file} (${srcSizeMB} MB)`);

  if (existsSync(mp4Path)) {
    const outSize = (statSync(mp4Path).size / 1024 / 1024).toFixed(1);
    console.log(`  MP4 already exists (${outSize} MB) — skipping`);
    console.log('');
    continue;
  }

  // H.264 MP4 — max 720px wide, CRF 26, faststart for progressive streaming.
  // Handles HEVC→H.264 transcode (iPhone recordings) automatically.
  const args = [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-i', srcPath,
    '-vf', "scale='min(720,iw)':-2",
    '-c:v', 'libx264',
    '-crf', '26',
    '-preset', 'medium',
    '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart',
    '-c:a', 'aac',
    '-b:a', '96k',
    mp4Path
  ];

  const result = spawnSync(ffmpegPath, args, { stdio: 'inherit' });

  if (result.status !== 0) {
    console.log(`  ✗ Failed (exit ${result.status})`);
    console.log('');
    continue;
  }

  const outSize = (statSync(mp4Path).size / 1024 / 1024).toFixed(1);
  const pct = Math.round((1 - statSync(mp4Path).size / statSync(srcPath).size) * 100);
  console.log(`  ✓ ${base}.mp4 (${outSize} MB — ${pct}% smaller)`);
  console.log('');
}

console.log('Done.\n');
