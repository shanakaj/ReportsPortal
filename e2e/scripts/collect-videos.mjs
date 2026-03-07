#!/usr/bin/env node

/**
 * Collect and organise video recordings from Playwright test runs.
 *
 * Playwright saves videos with hashed filenames inside nested directories.
 * This script copies them to a flat output folder with descriptive names.
 *
 * Usage:
 *   node scripts/collect-videos.mjs [--output ./demo-videos]
 */

import { readdirSync, statSync, mkdirSync, copyFileSync, existsSync } from 'fs';
import { join, basename, extname } from 'path';

const TEST_VIDEOS_DIR = join(process.cwd(), 'test-videos');
const DEFAULT_OUTPUT = join(process.cwd(), 'demo-videos');

// Parse --output flag
const outputIndex = process.argv.indexOf('--output');
const OUTPUT_DIR = outputIndex !== -1 ? process.argv[outputIndex + 1] : DEFAULT_OUTPUT;

// Map test file names to friendly video names
const VIDEO_NAME_MAP = {
  '01-login-flow': '01-Authentication-Flow',
  '02-admin-space-management': '02-Admin-Space-Management',
  '03-customer-journey': '03-Customer-Journey',
  '04-feedback-lifecycle': '04-Feedback-Lifecycle',
  '05-analytics-audit': '05-Analytics-Audit-Log',
  '06-user-management': '06-User-Management-Impersonation',
  '07-security-boundaries': '07-Security-Boundaries',
};

function findVideos(dir, videos = []) {
  if (!existsSync(dir)) return videos;

  const entries = readdirSync(dir);
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      findVideos(fullPath, videos);
    } else if (extname(entry) === '.webm') {
      videos.push(fullPath);
    }
  }
  return videos;
}

function getFriendlyName(videoPath) {
  // Try to match the video path to a test file
  for (const [testName, friendlyName] of Object.entries(VIDEO_NAME_MAP)) {
    if (videoPath.includes(testName)) {
      return `${friendlyName}.webm`;
    }
  }
  // Fallback: use parent directory name
  const parts = videoPath.split('/');
  const parentDir = parts[parts.length - 2] || 'unknown';
  return `${parentDir}-${basename(videoPath)}`;
}

// ─── Main ────────────────────────────────────────────────────────────────────

console.log('🎬 Collecting Playwright video recordings...\n');
console.log(`  Source: ${TEST_VIDEOS_DIR}`);
console.log(`  Output: ${OUTPUT_DIR}\n`);

const videos = findVideos(TEST_VIDEOS_DIR);

if (videos.length === 0) {
  console.log('⚠️  No video files found. Run tests first:\n');
  console.log('  npm run test:video\n');
  process.exit(0);
}

// Create output directory
mkdirSync(OUTPUT_DIR, { recursive: true });

console.log(`Found ${videos.length} video(s):\n`);

for (const videoPath of videos) {
  const friendlyName = getFriendlyName(videoPath);
  const outputPath = join(OUTPUT_DIR, friendlyName);

  copyFileSync(videoPath, outputPath);
  console.log(`  ✅ ${friendlyName}`);
}

console.log(`\n🎉 Videos collected in: ${OUTPUT_DIR}`);
console.log('\nTo convert .webm to .mp4 (requires ffmpeg):');
console.log('  for f in demo-videos/*.webm; do ffmpeg -i "$f" -c:v libx264 "${f%.webm}.mp4"; done\n');
console.log('To merge all videos into one (requires ffmpeg):');
console.log('  ffmpeg -f concat -safe 0 -i <(for f in demo-videos/*.webm; do echo "file \'$f\'"; done) -c copy demo-videos/full-demo.webm\n');
