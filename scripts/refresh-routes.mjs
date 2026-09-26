// refresh-routes.mjs — re-scrape the MyWhoosh route list and rewrite
// routes.json. Weekly via .github/workflows/refresh-routes.yml.
// Usage: node scripts/refresh-routes.mjs [--fixture <html>] [--out <json>]
import { readFileSync, writeFileSync } from 'node:fs';
import { parseRoutesHtml } from './parse-routes.mjs';

const SOURCE_URL = 'https://mywhooshinfo.com/routes/';

function flag(name) {
  const i = process.argv.indexOf(name);
  return i === -1 ? null : process.argv[i + 1] ?? null;
}

const fixture = flag('--fixture');
const out = flag('--out') ?? new URL('../routes.json', import.meta.url);

let html;
if (fixture) {
  html = readFileSync(fixture, 'utf8');
} else {
  const res = await fetch(SOURCE_URL);
  if (!res.ok) throw new Error(`fetch ${SOURCE_URL}: HTTP ${res.status}`);
  html = await res.text();
}

const routes = parseRoutesHtml(html);
const explicitOut = flag('--out') !== null;
if (routes.length < 50 && !explicitOut) {
  throw new Error(`refusing to write: only ${routes.length} routes parsed (site layout changed?)`);
}
writeFileSync(out, JSON.stringify(routes, null, 2) + '\n');
console.log(`wrote ${routes.length} routes to ${out}`);
