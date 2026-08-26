import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';

const assetsDirectory = path.resolve('dist', 'assets');
const files = await readdir(assetsDirectory);
const failures = [];

for (const file of files.filter((name) => name.endsWith('.js'))) {
  const { size } = await stat(path.join(assetsDirectory, file));
  const limit = file.startsWith('pdf.worker')
    ? 1_200 * 1024
    : file.startsWith('vendor-pdf')
      ? 900 * 1024
      : 700 * 1024;

  if (size > limit) {
    failures.push(`${file}: ${(size / 1024).toFixed(1)} KiB exceeds ${(limit / 1024).toFixed(0)} KiB`);
  }
}

if (failures.length > 0) {
  throw new Error(`Production bundle budget exceeded:\n${failures.join('\n')}`);
}

console.log('Production JavaScript bundle budget passed.');
