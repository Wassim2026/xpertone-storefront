import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const publicProductsUrl = 'https://myodfvshmusywmhdozwt.supabase.co/rest/v1/products_public?select=*&order=sort_order&limit=1000';
const publishableKey = 'sb_publishable_yqVW7IVTIgSarj8nKwVTuQ_zrj80eQ-';
let products;
try {
  const response = await fetch(publicProductsUrl, { headers: { apikey: publishableKey } });
  if (!response.ok) throw new Error(`Supabase responded ${response.status}`);
  products = await response.json();
  fs.writeFileSync(path.join(root, 'data/products-live.json'), `${JSON.stringify(products, null, 2)}\n`);
} catch (error) {
  const saved = path.join(root, 'data/products-live.json');
  const fallback = fs.existsSync(saved) ? saved : path.join(root, 'data/products.json');
  if (!fs.existsSync(fallback)) throw error;
  products = JSON.parse(fs.readFileSync(fallback, 'utf8'));
  console.warn(`Using saved product snapshot: ${error.message}`);
}
const productTemplate = fs.readFileSync(path.join(root, 'product.html'), 'utf8');
const origin = 'https://www.xpertonecreative.com';
const today = new Date().toISOString().slice(0, 10);
const PAGE_SIZE = 24;

const esc = (value = '') => String(value).replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[c]));
const clean = (value = '') => String(value).replace(/\s+/g, ' ').trim();
const money = value => `AED ${Number(value || 0).toFixed(2).replace(/\.00$/, '')}`;
const uid = p => `${p.category}-${String(p.sku).toLowerCase()}`;
const productUrl = p => `${origin}/products/${encodeURIComponent(p.slug)}/`;
const categoryUrl = slug => `${origin}/category/${encodeURIComponent(slug)}/`;
const write = (file, content) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
};

const categoryCopy = {
  'safety-vests': {
    title: 'Safety Vests with Logo Printing in Dubai',
    description: 'Shop reflective safety vests in Dubai for construction, logistics and site teams. Bulk sizes, logo printing, UAE delivery and trade quantities from XpertOne Creative.',
    intro: 'Choose reflective safety vests for visitors, supervisors, engineers and general site crews. XpertOne Creative supplies bulk orders from Al Quoz, Dubai, with size planning and optional company logo or text printing.',
    guide: 'Select a vest by the work environment, visibility requirement, closure and pocket layout. Economy styles suit visitors and short-term projects, while zip-front, multi-pocket and two-tone styles are practical for supervisors and engineers. Confirm the required colour and reflective-tape arrangement with your site safety policy before ordering. For branded orders, provide a clear vector or high-resolution logo and specify front, back or both positions. We send an artwork proof before production. Most catalogue lines start from 10 pieces, with tiered pricing for larger quantities. Dubai delivery is normally faster for stocked items, while other Emirates are served through our UAE delivery network.',
    faq: [['Can safety vests carry our company logo?', 'Yes. Safety vests can be printed with an approved logo or text on the front, back or both.'], ['Which vest is suitable for supervisors?', 'Zip-front and pocketed styles are commonly selected for supervisors; always match the final choice to your site rules.'], ['Do you supply mixed sizes?', 'Yes. Enter the quantity required for each available size on the product page.']]
  },
  uniforms: {
    title: 'Workwear & Industrial Uniform Supplier Dubai',
    description: 'Bulk workwear and industrial uniforms in Dubai: pant-and-shirt sets, coveralls and cargo trousers with company branding, size planning and UAE delivery.',
    intro: 'Order coordinated workwear for construction, maintenance, logistics and facilities teams. Browse pant-and-shirt sets, coveralls, cargo trousers and related industrial uniforms with bulk sizing and optional branding.',
    guide: 'The right uniform depends on the job, fabric weight, climate, movement and visibility requirements. Lighter fabrics can improve comfort for routine indoor work, while heavier twill and cotton options provide more structure for demanding site use. Reflective configurations support visibility but should be selected against the employer’s risk assessment. Plan sizes from an actual staff list instead of estimating one average size. For branded uniforms, XpertOne can review DTF, heat-transfer or embroidery requirements according to the garment and artwork. Confirm logo position, colour and finished dimensions before production. Product pages show available sizes and current guide prices; final specifications, artwork and delivery timing are confirmed with the order.',
    faq: [['Can uniforms be branded?', 'Yes. Workwear and uniforms support company logo and text customization on eligible positions.'], ['Can we order a mixed size split?', 'Yes. Add quantities against each listed size before placing the item in the cart.'], ['Do you supply across the UAE?', 'Yes. We supply Dubai and deliver to customers throughout the Emirates.']]
  },
  'safety-shoes': {
    title: 'Safety Shoes Supplier Dubai & UAE',
    description: 'Shop bulk safety shoes in Dubai and the UAE, including low- and high-ankle work footwear. Compare sizes, materials and verified product specifications.',
    intro: 'Browse safety footwear for construction, warehouses, workshops and industrial teams. Compare low- and high-ankle styles, size availability and the verified product specifications shown for each model.',
    guide: 'Choose safety footwear according to the hazards identified for the role. Toe protection, midsole construction, outsole grip, ankle support and resistance claims vary by model, so check the individual specifications instead of choosing on appearance alone. Do not assume a safety standard unless it is stated on the product page or supporting manufacturer documentation. Arrange a sensible size mix for the workforce and allow for the socks normally worn on site. Safety shoes are sold as standard ecommerce products without logo customization. Add the required sizes and quantities directly to the cart, or contact the team when you need help matching footwear to a tender or site requirement.',
    faq: [['Are all safety shoes the same standard?', 'No. Standards and protective features differ by model; rely only on the verified specification shown for that product.'], ['Can I order mixed shoe sizes?', 'Yes. Select quantities for each available size on the product page.'], ['Do safety shoes include logo printing?', 'No. Safety shoes follow the normal ecommerce ordering flow without logo customization.']]
  },
  helmets: {
    title: 'Safety Helmets & Helmet Logo Printing Dubai',
    description: 'Industrial safety helmets and head protection in Dubai with bulk ordering, colour options and logo printing on eligible helmets. UAE supply from Al Quoz.',
    intro: 'Supply industrial helmets and related head protection for site teams, visitors and contractors. Eligible helmets can be customized with an approved company logo or text.',
    guide: 'Match head protection to the task, suspension type, compatibility requirements and the employer’s colour-coding policy. A helmet should not be selected only by colour or price. Check the verified standard and manufacturer information where it is available, and confirm compatibility before adding accessories. Replace damaged or heavily impacted helmets and follow the manufacturer’s inspection guidance. For branded helmets, artwork size and print position are limited by the curved shell and available printable area. Upload the logo on an eligible product page to preview placement, then approve the production artwork before printing. Bulk quantities and mixed colours can be discussed with the sales team when the required combination is not listed online.',
    faq: [['Can helmets be logo printed?', 'Eligible helmets can carry an approved company logo or text within the safe printable area.'], ['Do helmet colours have fixed meanings?', 'Colour policies vary between organizations and sites; follow your project’s approved colour-coding plan.'], ['Should a helmet be replaced after impact?', 'Follow the manufacturer’s instructions and site policy; damaged or impacted head protection should not remain in service.']]
  },
  'hand-protection': {
    title: 'Safety Gloves & Work Gloves Supplier UAE',
    description: 'Shop work gloves in the UAE for handling, cutting, welding and coated-grip applications. Compare materials, sizes and verified specifications.',
    intro: 'Browse hand protection for construction, workshops, warehouses and industrial handling. The range includes coated, leather, welding and cut-focused glove styles.',
    guide: 'Select gloves for the actual hazard rather than by colour or general appearance. Grip, dexterity, coating, cuff, liner and resistance level affect where a glove is appropriate. Welding gloves, coated handling gloves and cut-focused gloves are designed for different tasks and should not be treated as interchangeable. Use the product specification and any verified standard shown on the page, then confirm suitability through your workplace risk assessment. Hand protection follows the normal ecommerce flow without logo customization: choose the available size or unit, enter the required quantity and add the item to the cart. Contact XpertOne when you need a mixed glove order or help locating a specific verified rating.',
    faq: [['Which glove should I choose?', 'Choose according to the hazard, required dexterity, grip and verified resistance information for the product.'], ['Are gloves customizable?', 'No. Hand-protection products use the standard ecommerce ordering flow.'], ['Can you source a particular glove type?', 'Yes. Send the required material, standard, size range and quantity to the sales team.']]
  }
};

const defaultCategoryCopy = (name, count) => ({
  title: `${name} Supplier Dubai & UAE`,
  description: `Shop ${name.toLowerCase()} from XpertOne Creative in Dubai. Compare ${count} stocked products, sizes, specifications and bulk pricing for UAE delivery.`,
  intro: `Browse ${name.toLowerCase()} for construction, industrial, logistics and facilities requirements. Product pages show current stock details, available units and verified specifications.`,
  guide: `Choose products by the intended task and the verified specification shown on each item page. Do not rely only on colour, appearance or a general category label when a standard or protective rating is required. XpertOne Creative supplies customers from Al Quoz, Dubai, and delivers throughout the UAE. These items follow a normal ecommerce ordering flow: select the required unit or size, enter the quantity and add the product to the cart. For project quantities or an item not listed, send the technical requirement and required delivery date to the sales team for review.`,
  faq: [['Can I order online?', 'Yes. Select the quantity on the product page and add the item directly to the cart.'], ['Is logo customization available?', 'Logo and text customization is limited to safety vests, workwear uniforms and eligible helmets.'], ['Do you deliver across the UAE?', 'Yes. Delivery is available across the Emirates, subject to stock and order confirmation.']]
});

function normalise(p) {
  return {
    ...p,
    uid: uid(p),
    categoryName: p.category_name,
    priceStatus: p.price_is_fixed ? 'fixed' : 'indicative',
    images: Array.isArray(p.images) ? p.images : [],
    sizes: Array.isArray(p.sizes) ? p.sizes : []
  };
}

const list = products.map(normalise).filter(p => p.slug && p.category && p.title && p.in_stock !== false);
const groups = new Map();
for (const p of list) {
  if (!groups.has(p.category)) groups.set(p.category, []);
  groups.get(p.category).push(p);
}

function metaDescription(p) {
  const facts = [p.description, p.material, p.colour, p.standard].map(clean).filter(Boolean);
  const base = facts.join('. ') || `${p.title} available for bulk supply from XpertOne Creative in Dubai.`;
  const text = clean(`${base} Compare available sizes and order for UAE delivery.`);
  return text.length > 158 ? `${text.slice(0, 155).replace(/\s+\S*$/, '')}...` : text;
}

function staticProductBody(p) {
  const image = p.images[0];
  const description = clean(p.description || p.features?.[0] || `${p.title} supplied for trade and project orders in Dubai and across the UAE.`);
  const specs = [
    ['SKU', p.sku], ['Material', p.material], ['Colour', p.colour], ['Standard', p.standard],
    ['Origin', p.origin], ['Packing', p.packing], ['Available sizes', p.sizes.join(', ')]
  ].filter(([, v]) => clean(v));
  return `<nav aria-label="Breadcrumb" class="mb-3" style="font-size:.85rem"><a href="/">Home</a> / <a href="/category/${esc(p.category)}/">${esc(p.categoryName)}</a> / <span>${esc(p.title)}</span></nav>
  <div class="row g-4 g-lg-5">
    <div class="col-lg-6"><div class="gallery__main">${image ? `<img src="${esc(image)}" alt="${esc(p.title)}" width="800" height="800" decoding="async">` : ''}</div></div>
    <div class="col-lg-6"><span class="product-card__cat">${esc(p.categoryName)}</span><h1 class="mt-1">${esc(p.title)}</h1>
      ${p.subtitle ? `<p class="text-muted-xo">${esc(p.subtitle)}</p>` : ''}
      <p><strong>${money(p.price)}</strong> per piece, excluding VAT${p.priceStatus === 'indicative' ? ' - indicative and confirmed on quotation' : ''}.</p>
      <p>${esc(description)}</p>
      <p><a class="btn btn-xo" href="/product.html?p=${encodeURIComponent(p.uid)}">Choose sizes and order</a></p>
      <ul class="spec-list">${specs.map(([k, v]) => `<li><b>${esc(k)}</b><span>${esc(v)}</span></li>`).join('')}</ul>
    </div>
  </div>`;
}

function productSchema(p) {
  const schema = {
    '@context': 'https://schema.org', '@type': 'Product', name: p.title,
    description: metaDescription(p), sku: p.sku, image: p.images,
    brand: { '@type': 'Brand', name: 'XpertOne Creative - Prints & Safety' },
    url: productUrl(p)
  };
  if (p.priceStatus === 'fixed') schema.offers = {
    '@type': 'Offer', priceCurrency: 'AED', price: p.price,
    availability: 'https://schema.org/InStock', itemCondition: 'https://schema.org/NewCondition',
    seller: { '@id': `${origin}/#business` }, url: productUrl(p)
  };
  return schema;
}

function generateProduct(p) {
  const canonical = productUrl(p);
  const description = metaDescription(p);
  const image = p.images[0] || `${origin}/assets/img/brand/og-xpertone.png`;
  const breadcrumb = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${origin}/` },
      { '@type': 'ListItem', position: 2, name: p.categoryName, item: categoryUrl(p.category) },
      { '@type': 'ListItem', position: 3, name: p.title, item: canonical }
    ]
  };
  let html = productTemplate
    .replace('<head>', '<head>\n<base href="/">')
    .replace('<title>Product — XpertOne Prints</title>', `<title>${esc(p.title)} | ${esc(p.categoryName)} Dubai</title>`)
    .replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${esc(description)}">\n<link rel="canonical" href="${canonical}">\n<meta property="og:type" content="product">\n<meta property="og:title" content="${esc(p.title)}">\n<meta property="og:description" content="${esc(description)}">\n<meta property="og:url" content="${canonical}">\n<meta property="og:image" content="${esc(image)}">\n<script type="application/ld+json" data-static-product-schema>${JSON.stringify(productSchema(p))}</script>\n<script type="application/ld+json">${JSON.stringify(breadcrumb)}</script>`)
    .replace('<meta name="robots" content="noindex,follow">', '<meta name="robots" content="index,follow">')
    .replace(/<div class="container py-4" id="pdp">[\s\S]*?<\/div>\n\n  <section class="section section--alt" id="relatedWrap"/, `<div class="container py-4" id="pdp">${staticProductBody(p)}</div>\n\n  <section class="section section--alt" id="relatedWrap"`)
    .replace('<script src="assets/js/config.js"></script>', `<script>window.XO_STATIC_PRODUCT_UID=${JSON.stringify(p.uid)};</script>\n<script src="assets/js/config.js"></script>`);
  write(path.join(root, 'products', p.slug, 'index.html'), html);
}

function productCard(p) {
  const image = p.images[0];
  return `<div class="col-6 col-lg-4 col-xl-3"><article class="product-card"><a class="product-card__media" href="/products/${encodeURIComponent(p.slug)}/">${image ? `<img src="${esc(image)}" alt="${esc(p.title)}" loading="lazy" decoding="async" width="600" height="600">` : ''}</a><div class="product-card__body"><span class="product-card__cat">${esc(p.subcategory || p.categoryName)}</span><h3 class="product-card__title"><a href="/products/${encodeURIComponent(p.slug)}/">${esc(p.title)}</a></h3><div class="product-card__foot"><div class="product-card__price"><b>${money(p.price)}</b><span>${p.priceStatus === 'fixed' ? 'per piece, ex VAT' : 'indicative, ex VAT'}</span></div><a class="btn btn-xo btn-sm-xo" href="/products/${encodeURIComponent(p.slug)}/">View</a></div></div></article></div>`;
}

function categoryPage(slug, items, page) {
  const name = items[0].categoryName;
  const copy = categoryCopy[slug] || defaultCategoryCopy(name, items.length);
  const pages = Math.ceil(items.length / PAGE_SIZE);
  const shown = items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const canonical = page === 1 ? categoryUrl(slug) : `${categoryUrl(slug)}page/${page}/`;
  const title = `${copy.title}${page > 1 ? ` - Page ${page}` : ''} | XpertOne Creative`;
  const itemList = {
    '@context': 'https://schema.org', '@type': 'ItemList', name,
    itemListElement: shown.map((p, i) => ({ '@type': 'ListItem', position: (page - 1) * PAGE_SIZE + i + 1, url: productUrl(p), name: p.title }))
  };
  const breadcrumb = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: `${origin}/` },
    { '@type': 'ListItem', position: 2, name, item: categoryUrl(slug) }
  ]};
  const pagination = `<nav class="d-flex justify-content-center gap-2 mt-5" aria-label="Category pages">${page > 1 ? `<a class="btn btn-outline-xo" href="${page === 2 ? `/category/${slug}/` : `/category/${slug}/page/${page - 1}/`}">Previous</a>` : ''}${page < pages ? `<a class="btn btn-xo" href="/category/${slug}/page/${page + 1}/">Next page</a>` : ''}</nav>`;
  const faq = page === 1 ? `<section class="section section--alt"><div class="container"><h2>Buying ${esc(name)} in Dubai</h2><p>${esc(copy.guide)}</p><div class="faq-grid">${copy.faq.map(([q, a]) => `<article><h3>${esc(q)}</h3><p>${esc(a)}</p></article>`).join('')}</div></div></section>` : '';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><base href="/"><title>${esc(title)}</title><meta name="description" content="${esc(copy.description)}"><link rel="canonical" href="${canonical}">${page > 1 ? '<meta name="robots" content="noindex,follow">' : ''}<meta property="og:type" content="website"><meta property="og:title" content="${esc(copy.title)}"><meta property="og:description" content="${esc(copy.description)}"><meta property="og:url" content="${canonical}"><meta property="og:image" content="${origin}/assets/img/brand/og-xpertone.png"><link rel="icon" type="image/png" sizes="32x32" href="assets/img/brand/favicon-32.png"><link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css"><link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css"><link rel="stylesheet" href="assets/css/main.css?v=20260902"><script type="application/ld+json">${JSON.stringify(itemList)}</script><script type="application/ld+json">${JSON.stringify(breadcrumb)}</script></head><body data-page="shop"><a class="skip-link" href="#main">Skip to content</a><div id="siteHeader"></div><main id="main"><section class="section section--alt"><div class="container"><nav aria-label="Breadcrumb"><a href="/">Home</a> / <a href="/shop.html">Shop</a> / <span>${esc(name)}</span></nav><h1 class="mt-3">${esc(copy.title)}</h1><p class="lead">${esc(copy.intro)}</p><p>${items.length} products available in this range.</p></div></section><section class="section"><div class="container"><div class="row g-4">${shown.map(productCard).join('')}</div>${pagination}</div></section>${faq}</main><div id="siteFooter"></div><script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script><script src="assets/js/config.js?v=20260902"></script><script src="assets/js/store.js?v=20260902"></script><script src="assets/js/ui.js?v=20260902"></script></body></html>`;
}

fs.rmSync(path.join(root, 'products'), { recursive: true, force: true });
fs.rmSync(path.join(root, 'category'), { recursive: true, force: true });
for (const p of list) generateProduct(p);
for (const [slug, items] of groups) {
  const pages = Math.ceil(items.length / PAGE_SIZE);
  for (let page = 1; page <= pages; page++) {
    const target = page === 1 ? path.join(root, 'category', slug, 'index.html') : path.join(root, 'category', slug, 'page', String(page), 'index.html');
    write(target, categoryPage(slug, items, page));
  }
}

const staticUrls = [
  [`${origin}/`, 'weekly', '1.0'], [`${origin}/shop.html`, 'daily', '0.8'],
  [`${origin}/about.html`, 'monthly', '0.6'], [`${origin}/contact.html`, 'monthly', '0.7']
];
const xml = rows => `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${rows.map(([url, freq, priority]) => `  <url><loc>${esc(url)}</loc><lastmod>${today}</lastmod><changefreq>${freq}</changefreq><priority>${priority}</priority></url>`).join('\n')}\n</urlset>\n`;
write(path.join(root, 'sitemap-pages.xml'), xml(staticUrls));
write(path.join(root, 'sitemap-categories.xml'), xml([...groups.keys()].map(slug => [categoryUrl(slug), 'weekly', '0.8'])));
write(path.join(root, 'sitemap-products.xml'), xml(list.map(p => [productUrl(p), 'weekly', '0.6'])));
write(path.join(root, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <sitemap><loc>${origin}/sitemap-pages.xml</loc><lastmod>${today}</lastmod></sitemap>\n  <sitemap><loc>${origin}/sitemap-categories.xml</loc><lastmod>${today}</lastmod></sitemap>\n  <sitemap><loc>${origin}/sitemap-products.xml</loc><lastmod>${today}</lastmod></sitemap>\n</sitemapindex>\n`);

const redirect = (to, title) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex,follow"><link rel="canonical" href="${to}"><meta http-equiv="refresh" content="0;url=${to}"><title>${esc(title)}</title></head><body><p>This page moved to <a href="${to}">${esc(title)}</a>.</p></body></html>`;
write(path.join(root, 'category', 'shoes', 'index.html'), redirect(`${origin}/category/safety-shoes/`, 'Safety Shoes'));

console.log(JSON.stringify({ products: list.length, categories: groups.size, categoryPages: [...groups.values()].reduce((n, x) => n + Math.ceil(x.length / PAGE_SIZE), 0) }));
