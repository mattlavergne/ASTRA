import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
const htmlPath=resolve('dist/index.html'),html=readFileSync(htmlPath,'utf8');
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
assert.equal(new Set(ids).size,ids.length,'HTML IDs must be unique');
for(const m of html.matchAll(/(?:href|src)="([^"]+)"/g)){const ref=m[1];if(ref.startsWith('#'))assert.ok(ids.includes(ref.slice(1)),`Missing icon ${ref}`);else if(!/^(https?:|data:|mailto:)/.test(ref))assert.ok(existsSync(resolve(dirname(htmlPath),ref)),`Missing asset ${ref}`);}
const app=readFileSync('dist/app.js','utf8');
const dynamicIds=[...app.matchAll(/\bid=["']([a-z][a-z0-9-]*)["']/g)].map(m=>m[1]);
for(const m of app.matchAll(/\$\(['"]#([a-z][a-z0-9-]*)['"]\)/g))assert.ok([...ids,...dynamicIds].includes(m[1]),`Missing control ${m[1]}`);
for(const file of readdirSync('dist').filter(n=>n.endsWith('.js'))){const source=readFileSync('dist/'+file,'utf8');const result=spawnSync(process.execPath,['--check','dist/'+file],{encoding:'utf8'});assert.equal(result.status,0,result.stderr);for(const m of source.matchAll(/(?:from\s*|new URL\()['"](\.[^'"]+)['"]/g))assert.ok(existsSync(resolve('dist',m[1])),`Missing module ${m[1]}`);}
for(const input of ['bpm','swing','project-title','sound-search','pattern-length','octave','note-length']){const tag=html.match(new RegExp('<(?:input|select)[^>]*id="'+input+'"[^>]*>'))?.[0];assert.ok(tag,`Missing ${input}`);assert.ok(tag.includes('aria-label')||html.includes(`for="${input}"`)||new RegExp('<label[^>]*>[^<]*<select id="'+input+'"').test(html),`Missing label ${input}`);}
const hosting=JSON.parse(readFileSync('.openai/hosting.json','utf8'));assert.equal(hosting.static.directory,'dist');assert.equal(hosting.project_id,'appgprj_6aa171ce2c84819181a5e8143d1171f5');
assert.ok(!html.includes('og:image'),'No unrequested social image');
assert.ok(!/gravity playground|constellation|universe/i.test(html),'Old concept remains in the UI');
const css=readFileSync('dist/styles.css','utf8');assert.ok(!/font(?:-size)?:\s*(?:[0-9]|1[01])px\b/.test(css),'Text smaller than 12px');
console.log('Entrypoint, imports, worker, control references, labels, text sizes, JavaScript syntax, and existing Site identity verified.');
