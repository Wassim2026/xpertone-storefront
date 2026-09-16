import fs from 'node:fs';
import path from 'node:path';

const productsPath = path.resolve('data/products-live.json');
const outputDir = path.resolve('../../outputs/whatsapp-catalogue');
const products = JSON.parse(fs.readFileSync(productsPath, 'utf8'));

const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
const csv = (value) => `"${clean(value).replaceAll('"', '""')}"`;
const headers = [
  'id', 'title', 'description', 'availability', 'condition', 'price',
  'link', 'image_link', 'brand', 'product_type', 'custom_label_0',
  'custom_label_1', 'custom_label_2'
];

const rows = products.map((product) => {
  const category = clean(product.category_name || product.category);
  const subcategory = clean(product.subcategory || 'Other');
  const unit = clean(product.unit || product.sizes?.[0] || 'piece');
  const details = clean(product.description || product.subtitle || `${category} supplied by Xpertone Creative in Dubai and across the UAE.`);
  const description = `${details} SKU: ${clean(product.sku)}. Unit: ${unit}.`;
  const link = `https://www.xpertonecreative.com/products/${product.slug}/`;
  return [
    product.sku,
    product.title,
    description,
    product.in_stock ? 'in stock' : 'out of stock',
    'new',
    `${Number(product.price || 0).toFixed(2)} AED`,
    link,
    product.images?.[0] || '',
    'Xpertone Creative',
    `${category} > ${subcategory}`,
    category,
    subcategory,
    unit
  ].map(csv).join(',');
});

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(path.join(outputDir, 'xpertone-whatsapp-catalogue.csv'), [headers.join(','), ...rows].join('\r\n') + '\r\n');

const summary = {
  generated_at: new Date().toISOString(),
  source: 'https://www.xpertonecreative.com',
  product_count: products.length,
  in_stock_count: products.filter((p) => p.in_stock).length,
  out_of_stock_count: products.filter((p) => !p.in_stock).length,
  categories: Object.entries(products.reduce((acc, p) => {
    const key = clean(p.category_name || p.category);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {})).sort(([a], [b]) => a.localeCompare(b)).map(([name, count]) => ({ name, count }))
};
fs.writeFileSync(path.join(outputDir, 'manifest.json'), JSON.stringify(summary, null, 2) + '\n');
console.log(JSON.stringify(summary, null, 2));
