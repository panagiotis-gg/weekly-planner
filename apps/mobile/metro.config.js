// Expo configures Metro for the pnpm monorepo automatically (SDK 52+); only web SQLite needs extras.
const http = require('node:http');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// expo-sqlite on web loads wa-sqlite as a .wasm asset.
config.resolver.assetExts.push('wasm');

// expo-sqlite on web needs SharedArrayBuffer, which requires a cross-origin isolated page.
// The Expo dev server serves the HTML before custom Metro middleware runs, and the expo-router
// `headers` plugin option only applies to EAS Hosting, so set the headers on every response of
// this dev-server process. Production web hosting must send the same two headers itself.
const ISOLATION_HEADERS = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'credentialless',
};
const writeHead = http.ServerResponse.prototype.writeHead;
http.ServerResponse.prototype.writeHead = function writeHeadWithIsolation(...args) {
  if (!this.headersSent) {
    for (const [name, value] of Object.entries(ISOLATION_HEADERS)) {
      if (!this.hasHeader(name)) this.setHeader(name, value);
    }
  }
  return writeHead.apply(this, args);
};

module.exports = config;
