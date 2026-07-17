import { copyFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const source = join(__dirname, '..', 'node_modules', '@ffmpeg', 'core', 'dist', 'ffmpeg-core.js');
const dest = join(__dirname, '..', 'public', 'ffmpeg-core.js');

// 如果源文件不存在，则跳过并正常退出（不报错）
if (!existsSync(source)) {
  console.warn('⚠️ ffmpeg-core.js not found, skipping copy.');
  process.exit(0);  // ← 关键：正常退出，不报错
}

try {
  await mkdir(dirname(dest), { recursive: true });
  await copyFile(source, dest);
  console.log('✅ ffmpeg-core.js copied successfully!');
} catch (err) {
  console.error('❌ Failed to copy ffmpeg-core.js:', err);
  process.exit(1);
}