import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const categories = [
  ['Hand Protection', 'hand-protection'],
  ['Eye & Face Protection', 'eye-face-protection'],
  ['Hearing & Respiratory', 'hearing-respiratory'],
  ['Traffic & Road Safety', 'traffic-safety'],
  ['Hardware - Tools', 'hardware-tools'],
];
const productRoot = path.join(root, 'products');
const productFiles = fs.readdirSync(productRoot)
  .map(slug => path.join(productRoot, slug, 'index.html'))
  .filter(fs.existsSync);
const htmlFiles = [];
function collectHtml(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collectHtml(full);
    else if (entry.name === 'index.html') htmlFiles.push(full);
  }
}
collectHtml(path.join(root, 'category'));

const escapeRegExp = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const mapping = [];
const productsJsonPath = path.join(root, 'data', 'products-live.json');
const products = JSON.parse(fs.readFileSync(productsJsonPath, 'utf8'));

for (const [sourceName, slug] of categories) {
  const sourceDir = `C:/Users/PC/OneDrive/XpertOne Business/Mockups/${sourceName}`;
  const assetDir = path.join(root, 'assets', 'img', 'products', slug);
  fs.mkdirSync(assetDir, { recursive: true });
  const files = fs.readdirSync(sourceDir).filter(name => name.toLowerCase().endsWith('.png'));
  for (const file of files) {
    const sku = path.parse(file).name;
    fs.copyFileSync(path.join(sourceDir, file), path.join(assetDir, `${sku}.png`));
    const newUrl = `/assets/img/products/${slug}/${encodeURIComponent(sku)}.png`;
    const marker = new RegExp(`<b>SKU</b><span>${escapeRegExp(sku)}</span>`);
    const productFile = productFiles.find(candidate => marker.test(fs.readFileSync(candidate, 'utf8')));
    if (!productFile) throw new Error(`${sku}: product page not found`);
    let html = fs.readFileSync(productFile, 'utf8');
    const oldUrl = html.match(/<meta property="og:image" content="([^"]+)"/)?.[1];
    if (!oldUrl) throw new Error(`${sku}: existing main image not found`);
    html = html.split(oldUrl).join(newUrl);
    fs.writeFileSync(productFile, html);
    const productSlug = path.basename(path.dirname(productFile));
    const cardPattern = new RegExp(`(<a class="product-card__media" href="/products/${escapeRegExp(productSlug)}/"><img src=")[^"]+(" )`);
    for (const categoryFile of htmlFiles) {
      const before = fs.readFileSync(categoryFile, 'utf8');
      const after = before
        .split(oldUrl).join(newUrl)
        .replace(cardPattern, `$1${newUrl}$2`);
      if (after !== before) fs.writeFileSync(categoryFile, after);
    }
    const product = products.find(item => String(item.sku).toLowerCase() === sku.toLowerCase());
    if (!product) throw new Error(`${sku}: products-live entry not found`);
    product.images = [newUrl, ...product.images.filter(url => url !== newUrl)];
    mapping.push({ sku, category: slug, page: productSlug, oldUrl, newUrl });
  }
}

fs.writeFileSync(productsJsonPath, `${JSON.stringify(products, null, 2)}\n`);
fs.writeFileSync(path.join(root, 'data', 'five-category-image-map.json'), `${JSON.stringify(mapping, null, 2)}\n`);
console.log(JSON.stringify({ updated: mapping.length, categoryHtmlFiles: htmlFiles.length }));
