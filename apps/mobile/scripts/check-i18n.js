// Fails when a UI language is missing keys or {{placeholders}} compared with English (DECISIONS F3).
const path = require('node:path');

const dir = path.join(__dirname, '..', 'src', 'i18n');
const en = require(path.join(dir, 'en.json'));
const others = { el: require(path.join(dir, 'el.json')) };

const keys = (obj, prefix = '') =>
  Object.entries(obj).flatMap(([k, v]) => (typeof v === 'object' ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`]));
const get = (obj, key) => key.split('.').reduce((o, k) => o?.[k], obj);
const vars = (s) => (String(s).match(/{{\w+}}/g) ?? []).sort().join(',');

let failed = false;
const enKeys = keys(en);
for (const [lang, messages] of Object.entries(others)) {
  const langKeys = new Set(keys(messages));
  const missing = enKeys.filter((k) => !langKeys.has(k));
  const extra = [...langKeys].filter((k) => !enKeys.includes(k));
  const mismatched = enKeys.filter((k) => langKeys.has(k) && vars(get(en, k)) !== vars(get(messages, k)));
  for (const [label, list] of [['missing', missing], ['extra', extra], ['placeholder mismatch', mismatched]]) {
    if (list.length) {
      failed = true;
      console.error(`${lang}: ${label}: ${list.join(', ')}`);
    }
  }
  if (!missing.length && !extra.length && !mismatched.length) console.log(`${lang}: ${langKeys.size} keys OK`);
}
process.exit(failed ? 1 : 0);
