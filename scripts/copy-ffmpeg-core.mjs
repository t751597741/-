import { mkdir, copyFile, stat } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const srcDir = path.join(root, 'node_modules', '@ffmpeg', 'core', 'dist');
const destDir = path.join(root, 'public', 'ffmpeg');

const files = [
  'ffmpeg-core.js',
  'ffmpeg-core.wasm',
  'ffmpeg-core.worker.js',
];

async function exists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  await mkdir(destDir, { recursive: true });
  for (const file of files) {
    const from = path.join(srcDir, file);
    const to = path.join(destDir, file);
    if (!(await exists(from))) {
      throw new Error(`Missing ${from}`);
    }
    await copyFile(from, to);
  }
}

main().catch((err) => {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});

