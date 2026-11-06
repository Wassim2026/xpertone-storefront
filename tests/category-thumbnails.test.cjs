// Run from the repository root: node tests/category-thumbnails.test.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync('index.html', 'utf8');
const start = html.indexOf('  /* Category artwork');
const end = html.indexOf('\n  Catalog.load().then(function (all) {\n    var priority', start);
assert.ok(start > 0 && end > start);
const source = html.slice(start, end);
assert.ok(!source.includes('SUPABASE'));
assert.ok(!source.includes('fetch('));
const configContext = {window:{},document:{getElementsByTagName(){return [{parentNode:{insertBefore(){}}}];},createElement(){return {};}}};
// Only evaluate runtime configuration, not the unrelated existing tracking bootstrap.
const config = fs.readFileSync('assets/js/config.js','utf8');
vm.runInNewContext(config.slice(config.indexOf('window.XO_CONFIG =')),configContext);
const categories = configContext.window.XO_CONFIG.CATEGORIES;
async function scenario(fail) {
  let resolve, reject;
  const catalogue = new Promise((yes,no) => {resolve=yes;reject=no;});
  const mount = {innerHTML:''};
  const context = {XO_CONFIG:{CATEGORIES:categories},GridSkeleton(){},Catalog:{load(){return catalogue;}},XO:{el(){return mount;},esc(s){return String(s).replaceAll('&','&amp;').replaceAll('"','&quot;');}}};
  vm.runInNewContext(source,context);
  assert.equal((mount.innerHTML.match(/class="cat-tile"/g)||[]).length,11);
  assert.ok(mount.innerHTML.includes('Browse products'));
  const imagePaths=[...mount.innerHTML.matchAll(/<img src="([^"]+)"/g)].map(m=>m[1]);
  assert.equal(imagePaths.length,11);
  for (const p of imagePaths) {
    assert.ok(p.startsWith('/assets/img/category/'));
    assert.ok(fs.existsSync('.'+p),p);
    const bytes=fs.readFileSync('.'+p);
    assert.equal(bytes.toString('ascii',8,12),'WEBP',p);
  }
  assert.ok(!mount.innerHTML.includes('image-unavailable'));
  if(fail) reject(new Error('Simulated catalogue outage'));
  else resolve([{category:'safety-vests'},{category:'safety-vests'},{category:'uniforms'}]);
  await catalogue.catch(()=>{});
  await new Promise(done=>setImmediate(done));
  assert.equal((mount.innerHTML.match(/class="cat-tile"/g)||[]).length,11);
  assert.ok(mount.innerHTML.includes(fail?'Browse products':'2 products'));
  return imagePaths.length;
}
(async()=>{await scenario(false);await scenario(true);console.log('PASS: all 11 bundled thumbnails render before catalogue completion; counts update; API failure preserves every category; no Supabase image request.');})().catch(e=>{console.error(e);process.exitCode=1;});
