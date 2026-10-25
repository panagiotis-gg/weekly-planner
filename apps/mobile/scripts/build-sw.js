// Generates dist/sw.js after `expo export -p web`, so the installed web app opens offline.
// Precaches the whole build (JS bundles, the SQLite wasm and worker, icons) and serves
// index.html for in-app routes such as /week/2026-10-19 (single-page app).
const path = require('node:path');
const { generateSW } = require('workbox-build');

const dist = path.join(__dirname, '..', 'dist');

generateSW({
  globDirectory: dist,
  globPatterns: [
    '**/*.{html,js,css,wasm,json,png,ico,ttf,woff,woff2}',
    // Expo emits package assets (e.g. the SQLite wasm) under assets/__node_modules/.pnpm/…;
    // glob skips dot-folders unless a pattern names them explicitly.
    '**/.pnpm/**/*.{wasm,png,ttf,woff,woff2}',
  ],
  globIgnores: ['sw.js', 'workbox-*.js', '_headers', '_redirects', 'push-sw.js'],
  // Reminder notifications: push and notification-tap handlers (public/push-sw.js).
  importScripts: ['push-sw.js'],
  swDest: path.join(dist, 'sw.js'),
  navigateFallback: '/index.html',
  navigateFallbackDenylist: [/^\/_expo\//, /\.[a-z0-9]+$/i],
  // The web bundle and the wa-sqlite wasm are several MB each.
  maximumFileSizeToCacheInBytes: 20 * 1024 * 1024,
  // A new version activates on the next app start, without waiting for every tab to close.
  skipWaiting: true,
  clientsClaim: true,
  cleanupOutdatedCaches: true,
  inlineWorkboxRuntime: true,
  sourcemap: false,
})
  .then(({ count, size, warnings }) => {
    for (const w of warnings) console.warn(w);
    console.log(`sw.js: precaches ${count} files (${(size / 1024 / 1024).toFixed(1)} MB)`);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
