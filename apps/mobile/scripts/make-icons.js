// Renders the app icon (an SVG weekly-planner page) to every PNG size the app needs.
// Run: pnpm --filter @planner/mobile icons
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');

// Pastel day colours (src/ui/theme.ts DEFAULT_DAY_COLORS), Monday → Sunday.
const DAYS = ['#F2C38E', '#EFA9A1', '#E89BAE', '#C9B3E6', '#A9C8EC', '#A8D8B9', '#F3DC8B'];
const HEIGHTS = [300, 240, 330, 200, 280, 160, 220];

function iconSvg({ padding = 0 } = {}) {
  // `padding` shrinks the artwork for maskable icons (Android crops to a circle).
  const s = 1 - padding;
  const cols = DAYS.map((color, i) => {
    const x = 234 + i * 82;
    const h = HEIGHTS[i];
    return `<rect x="${x}" y="${760 - h}" width="64" height="${h}" rx="16" fill="${color}"/>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <rect width="1024" height="1024" fill="#FAF7F2"/>
  <g transform="translate(${512 * (1 - s)} ${512 * (1 - s)}) scale(${s})">
    <rect x="192" y="232" width="640" height="580" rx="72" fill="#FFFFFF" stroke="#E4DCD1" stroke-width="8"/>
    <path d="M264 232h496a72 72 0 0 1 72 72v78H192v-78a72 72 0 0 1 72-72z" fill="#C9846B"/>
    <rect x="330" y="186" width="36" height="112" rx="18" fill="#3A3330"/>
    <rect x="658" y="186" width="36" height="112" rx="18" fill="#3A3330"/>
    ${cols}
  </g>
</svg>`;
}

const root = path.join(__dirname, '..');
const outputs = [
  // Home-screen web app (public/ is copied to the web build).
  { file: 'public/icons/apple-touch-icon.png', size: 180 },
  { file: 'public/icons/icon-192.png', size: 192 },
  { file: 'public/icons/icon-512.png', size: 512 },
  { file: 'public/icons/maskable-512.png', size: 512, padding: 0.2 },
  // Expo app config (native icon and web favicon).
  { file: 'assets/icon.png', size: 1024 },
  { file: 'assets/favicon.png', size: 48 },
];

(async () => {
  for (const { file, size, padding } of outputs) {
    const dest = path.join(root, file);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    await sharp(Buffer.from(iconSvg({ padding }))).resize(size, size).png().toFile(dest);
    console.log(`${file} (${size}×${size})`);
  }
})();
