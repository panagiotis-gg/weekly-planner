// Extends app.json with which build is running, shown on the Settings page so it's clear whether a
// device has picked up the latest deploy (the PWA updates in the background).
const { execSync } = require('node:child_process');

function commit() {
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return (process.env.CF_PAGES_COMMIT_SHA ?? '').slice(0, 7) || 'unknown';
  }
}

module.exports = ({ config }) => ({
  ...config,
  extra: {
    ...config.extra,
    build: { commit: commit(), time: new Date().toISOString() },
  },
});
