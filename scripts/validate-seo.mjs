import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const products = JSON.parse(fs.readFileSync(path.join(root, 'data/products-live.json'), 'utf8'));
const serviceSlugs = ['custom-safety-vest-printing-dubai','safety-vest-supplier-dubai','construction-uniforms-dubai','coverall-supplier-dubai','work-uniform-supplier-uae','safety-helmet-printing-dubai','ppe-supplier-dubai','custom-polo-shirts-dubai','dtf-printing-dubai','embroidery-dubai'];
const failures = [];
let checked = 0, schemas = 0;

function checkFile(file) {
  const html = fs.readFileSync(file, 'utf8');
  checked++;
  if (!/<title>[^<]+<\/title>/.test(html)) failures.push(`${file}: missing title`);
  if (!/<meta name="description" content="[^"]+">/.test(html)) failures.push(`${file}: missing description`);
  if (!/<link rel="canonical" href="https:\/\/www\.xpertonecreative\.com\//.test(html)) failures.push(`${file}: missing canonical`);
  for (const match of html.matchAll(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) {
    try { JSON.parse(match[1]); schemas++; } catch { failures.push(`${file}: invalid JSON-LD`); }
  }
}

for (const product of products.filter(p => p.in_stock !== false)) {
  const file = path.join(root, 'products', product.slug, 'index.html');
  if (!fs.existsSync(file)) { failures.push(`${product.slug}: missing product page`); continue; }
  checkFile(file);
  const html = fs.readFileSync(file, 'utf8');
  const image = html.match(/<div class="gallery__main"><img src="([^"]+)" alt="([^"]+)" title="([^"]+)"/) || [];
  if (product.images?.length && !image[1]?.includes(`/assets/catalog/${product.slug}/`)) failures.push(`${product.slug}: non-slug main image`);
  if (image[2] !== image[3]) failures.push(`${product.slug}: image alt/title mismatch`);
  const imageTokens = path.basename(image[1] || '', path.extname(image[1] || '')).toLowerCase().split('-');
  if (image[1] && String(product.sku) && imageTokens.includes(String(product.sku).toLowerCase())) failures.push(`${product.slug}: SKU in image filename`);
}
for (const slug of serviceSlugs) {
  const file = path.join(root, slug, 'index.html');
  if (!fs.existsSync(file)) failures.push(`${slug}: missing service page`); else checkFile(file);
}
const sitemap = fs.readFileSync(path.join(root, 'sitemap-pages.xml'), 'utf8');
for (const slug of serviceSlugs) if (!sitemap.includes(`/${slug}/`)) failures.push(`${slug}: absent from sitemap`);

if (failures.length) {
  console.error(failures.slice(0, 50).join('\n'));
  console.error(JSON.stringify({ checked, schemas, failures: failures.length }));
  process.exit(1);
}
console.log(JSON.stringify({ checked, schemas, products: products.length, servicePages: serviceSlugs.length, failures: 0 }));
