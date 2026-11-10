// Renders the YouTube thumbnail (film.js ?thumb=1) to livrables-ready PNGs. Run from the project root.
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const ROOT = path.resolve('facebook'), OUT = path.resolve('out/facebook');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.woff2': 'font/woff2', '.png': 'image/png' };
const srv = http.createServer((q, r) => { const f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0])); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); r.end(d); }); }).listen(0);
const port = srv.address().port, b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
await p.goto(`http://127.0.0.1:${port}/index.html?render=1&format=16x9&thumb=1`); await p.waitForFunction(() => window.filmReady);
fs.mkdirSync(OUT, { recursive: true });
await (await p.$('canvas')).screenshot({ path: path.join(OUT, 'miniature.png') });
await b.close(); srv.close(); console.log('out/facebook/miniature.png');
