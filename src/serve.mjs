// Tiny local preview server: npm run serve, then open http://localhost:4173
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');
const types = { html: 'text/html; charset=utf-8', css: 'text/css', js: 'text/javascript', webp: 'image/webp', png: 'image/png', jpg: 'image/jpeg', ico: 'image/x-icon', xml: 'application/xml', txt: 'text/plain', webmanifest: 'application/manifest+json' };
http.createServer(async (req, res) => {
  let p = path.join(dist, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!p.startsWith(dist)) { res.writeHead(403).end(); return; }
  try {
    if ((await stat(p)).isDirectory()) p = path.join(p, 'index.html');
    res.writeHead(200, { 'content-type': types[p.split('.').pop()] || 'application/octet-stream' }).end(await readFile(p));
  } catch {
    res.writeHead(404, { 'content-type': types.html }).end(await readFile(path.join(dist, '404.html')).catch(() => 'Not found'));
  }
}).listen(4173, () => console.log('Preview at http://localhost:4173'));
