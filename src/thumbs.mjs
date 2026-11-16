// Makes a small, fast-loading copy of each episode's artwork.
// Captivate's originals are 3000 pixels wide; the site shows them at a few hundred.
import { mkdir, access, copyFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

const exists = (p) => access(p).then(() => true, () => false);
export const THUMB = 480;

export async function makeThumb(ep, { cacheDir, outDir }) {
  if (!ep.image) return '';
  const key = createHash('sha1').update(ep.image).digest('hex').slice(0, 16);
  const cached = path.join(cacheDir, `${key}.jpg`);
  try {
    if (!(await exists(cached))) {
      const sharp = (await import('sharp')).default;
      const res = await fetch(ep.image, { signal: AbortSignal.timeout(30000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const small = await sharp(Buffer.from(await res.arrayBuffer()))
        .resize(THUMB, THUMB, { fit: 'cover' }).jpeg({ quality: 80, mozjpeg: true }).toBuffer();
      await mkdir(cacheDir, { recursive: true });
      await writeFile(cached, small);
    }
    await mkdir(outDir, { recursive: true });
    await copyFile(cached, path.join(outDir, `${ep.slug}.jpg`));
    return `/img/ep/${ep.slug}.jpg`;
  } catch (e) {
    console.warn(`  artwork not resized for "${ep.title}" (${e.message}); using Captivate's copy`);
    return ep.image; // still shows, just a heavier file
  }
}
