import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const outDir = path.resolve(root, '..', '..', 'outputs', 'catalogue-mockups');
const products = JSON.parse(fs.readFileSync(path.join(root, 'data', 'products-live.json'), 'utf8'));
const watermarkMockups = new Set(['ADG', 'FBM', 'NLQ', 'RGF', 'RGO', 'SKO', 'SOU']);

function imageMatchesSku(url, sku) {
  const u = decodeURIComponent(String(url || '')).toUpperCase();
  const s = String(sku || '').toUpperCase();
  return u.includes('/' + s + '.') || u.includes('/' + s + '/') || u.includes('-' + s + '.') || u.includes('/' + s + '-');
}

function correctedCategory(product) {
  if (product.category !== 'safety-vests') return product.category;
  const t = product.title.toLowerCase();
  if (/\b(vest|waistcoat)\b/.test(t)) return 'safety-vests';
  if (/spectacle|goggle|eyewear|face shield|face window/.test(t)) return 'eye-face-protection';
  if (/glove/.test(t)) return 'hand-protection';
  if (/shoe|footwear|\bboot\b|boots/.test(t)) return 'safety-shoes';
  if (/helmet|bump cap|chin strap|full brim/.test(t)) return 'helmets';
  if (/coverall|pant.{0,8}shirt|lab coat|cargo pant|winter jacket|trouser set|fire fighter hood|fire fighting suit|fr shirt/.test(t)) return 'uniforms';
  if (/solar warning|traffic baton|traffic cone|road barrier/.test(t)) return 'traffic-safety';
  if (/hammer|warning tape|reflective tape|fire blanket|cargo lashing|pvc chain|saw blade|water bottle|disposal bag/.test(t)) return 'hardware-tools';
  if (/earplug|ear plug|earmuff|respirator|dust mask|cartridge|filter for/.test(t)) return 'hearing-respiratory';
  if (/rain suit|rain coat|raincoat/.test(t)) return 'rainwear-marine';
  return product.category;
}

const rows = products.map(product => {
  const images = product.images || [];
  const primary = images[0] || '';
  const candidates = images.filter(url => imageMatchesSku(url, product.sku));
  const preferred = candidates.find(url => /xpertonecreative\.com\/assets/.test(url))
    || candidates.find(url => /supabase\.co\/storage/.test(url))
    || candidates[0]
    || primary;
  const categoryAfter = correctedCategory(product);
  const imageMismatch = Boolean(primary && preferred && primary !== preferred && !imageMatchesSku(primary, product.sku));
  const mockupCreated = watermarkMockups.has(product.sku);
  const mockupUrl = mockupCreated
    ? `https://www.xpertonecreative.com/assets/img/audit-mockups/${product.sku}.jpg`
    : '';
  const watermarkRisk = Boolean(mockupUrl && primary !== mockupUrl);
  return {
    id: product.id,
    sku: product.sku,
    title: product.title,
    colour: product.colour || '',
    visibility: 'visible',
    category_before: product.category,
    category_after: categoryAfter,
    primary_image_before: primary,
    primary_image_after: mockupUrl || (imageMismatch ? preferred : primary),
    category_mismatch: categoryAfter !== product.category,
    image_mismatch: imageMismatch,
    watermark_risk: watermarkRisk,
    mockup_created: mockupCreated,
    generated_file: mockupCreated ? path.join(outDir, `${product.sku}.jpg`) : '',
    status: categoryAfter !== product.category || imageMismatch || watermarkRisk ? 'correction-required' : 'verified'
  };
});

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'sku-image-audit-manifest.json'), JSON.stringify(rows, null, 2) + '\n');
const headers = Object.keys(rows[0]);
const csv = [headers.join(','), ...rows.map(row => headers.map(k => '"' + String(row[k] ?? '').replaceAll('"', '""') + '"').join(','))].join('\n') + '\n';
fs.writeFileSync(path.join(outDir, 'sku-image-audit-manifest.csv'), csv);
const corrections = rows.filter(r => r.category_mismatch || r.image_mismatch || r.watermark_risk).map(r => ({
  id: r.id,
  sku: r.sku,
  category: r.category_after,
  primary_image: r.primary_image_after,
  category_mismatch: r.category_mismatch,
  image_mismatch: r.image_mismatch,
  watermark_replacement: r.watermark_risk
}));
fs.writeFileSync(path.join(outDir, 'planned-live-corrections.json'), JSON.stringify(corrections, null, 2) + '\n');
fs.writeFileSync(path.join(root, 'data', 'catalogue-audit-corrections.json'), JSON.stringify(corrections, null, 2) + '\n');
console.log(JSON.stringify({
  audited: rows.length,
  categoryMismatches: rows.filter(r => r.category_mismatch).length,
  imageMismatches: rows.filter(r => r.image_mismatch).length,
  watermarkRisks: rows.filter(r => r.watermark_risk).length,
  corrections: corrections.length,
  outDir
}, null, 2));
