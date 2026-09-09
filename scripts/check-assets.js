import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import assert from 'node:assert/strict';

const htmlPath = resolve('dist/index.html');
const html = readFileSync(htmlPath, 'utf8');
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
assert.equal(new Set(ids).size, ids.length, 'HTML IDs must be unique');
for (const match of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
  const reference = match[1];
  if (reference.startsWith('#')) assert.ok(ids.includes(reference.slice(1)), `Missing SVG target ${reference}`);
  else if (!/^(https?:|data:|mailto:)/.test(reference)) assert.ok(existsSync(resolve(dirname(htmlPath), reference)), `Missing asset ${reference}`);
}
const app = readFileSync('dist/app.js', 'utf8');
for (const match of app.matchAll(/\$\('#([a-z][a-z0-9-]*)'\)/gi)) assert.ok(ids.includes(match[1]), `Missing control #${match[1]}`);
for (const match of app.matchAll(/from ['"](\.[^'"]+)['"]/g)) assert.ok(existsSync(resolve('dist', match[1])), `Missing module ${match[1]}`);
for (const input of ['gravity', 'speed', 'particles']) assert.ok(html.includes(`for="${input}"`), `Missing label for ${input}`);
const hosting = JSON.parse(readFileSync('.openai/hosting.json', 'utf8'));
assert.equal(hosting.static.directory, 'dist');
assert.ok(hosting.project_id, 'Hosting identity must be present');
assert.ok(!html.includes('og:image'), 'No unrequested social image');
console.log('Static entrypoint, local assets, icons, control references, and hosting manifest verified.');
