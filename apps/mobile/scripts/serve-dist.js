// Serves the web build (dist/) locally the way static hosting does: applies dist/_headers
// (Cloudflare Pages / Netlify format) and falls back to index.html for app routes.
// Run: pnpm --filter @planner/mobile serve:web   (after build:web)
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const dist = path.join(__dirname, '..', 'dist');
const port = Number(process.env.PORT ?? 8788);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.wasm': 'application/wasm',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.css': 'text/css',
  '.ttf': 'font/ttf',
};

/** Parses _headers: a path pattern line, then indented "Name: value" lines. */
function loadHeaderRules() {
  const file = path.join(dist, '_headers');
  if (!fs.existsSync(file)) return [];
  const rules = [];
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    if (!/^\s/.test(line)) {
      const pattern = new RegExp(`^${line.trim().replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`);
      rules.push({ pattern, headers: {} });
    } else if (rules.length) {
      const i = line.indexOf(':');
      rules.at(-1).headers[line.slice(0, i).trim()] = line.slice(i + 1).trim();
    }
  }
  return rules;
}

const rules = loadHeaderRules();

http
  .createServer((req, res) => {
    const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let file = path.join(dist, urlPath);
    if (!file.startsWith(dist)) return res.writeHead(400).end();
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      // Single-page app: unknown paths (e.g. /week/2026-10-19) get index.html.
      file = path.join(dist, 'index.html');
    }
    for (const rule of rules) {
      if (rule.pattern.test(urlPath)) for (const [k, v] of Object.entries(rule.headers)) res.setHeader(k, v);
    }
    res.setHeader('Content-Type', TYPES[path.extname(file)] ?? 'application/octet-stream');
    fs.createReadStream(file).pipe(res);
  })
  .listen(port, () => console.log(`Serving ${dist} on http://localhost:${port}`));
