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
const saleUnit = p => ({ pairs: 'pair', pair: 'pair', doz: 'dozen', dozen: 'dozen', mono: 'mono', pcs: 'piece', piece: 'piece' }[clean(p.unit).toLowerCase()] || clean(p.unit).toLowerCase() || 'piece');
const saleUnitLabel = p => saleUnit(p).replace(/^./, value => value.toUpperCase());
const uid = p => `${p.category}-${String(p.sku).toLowerCase()}`;
const productUrl = p => `${origin}/products/${encodeURIComponent(p.slug)}/`;
const categoryUrl = slug => `${origin}/category/${encodeURIComponent(slug)}/`;
const workwearUrl = slug => `${origin}/category/uniforms/${encodeURIComponent(slug)}/`;
const write = (file, content) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${String(content).replace(/\r\n?/g, '\n').replace(/[ \t]+$/gm, '').trimEnd()}\n`);
};

const categoryCopy = {
  'safety-vests': {
    title: 'Safety Vests with Logo Printing in Dubai',
    description: 'Shop reflective safety vests in Dubai for construction, logistics and site teams. Bulk sizes, logo printing, UAE delivery and trade quantities from Xpertone Creative LLC-FZ.',
    intro: 'Choose reflective safety vests for visitors, supervisors, engineers and general site crews. Xpertone Creative LLC-FZ supplies bulk orders from Al Quoz, Dubai, with size planning and optional company logo or text printing.',
    guide: 'Select a vest by the work environment, visibility requirement, closure and pocket layout. Economy styles suit visitors and short-term projects, while zip-front, multi-pocket and two-tone styles are practical for supervisors and engineers. Confirm the required colour and reflective-tape arrangement with your site safety policy before ordering. For branded orders, provide a clear vector or high-resolution logo and specify front, back or both positions. We send an artwork proof before production. Most catalogue lines start from 10 pieces, with tiered pricing for larger quantities. Dubai delivery is normally faster for stocked items, while other Emirates are served through our UAE delivery network.',
    faq: [['Can safety vests carry our company logo?', 'Yes. Safety vests can be printed with an approved logo or text on the front, back or both.'], ['Which vest is suitable for supervisors?', 'Zip-front and pocketed styles are commonly selected for supervisors; always match the final choice to your site rules.'], ['Do you supply mixed sizes?', 'Yes. Enter the quantity required for each available size on the product page.']]
  },
  uniforms: {
    title: 'Workwear & Industrial Uniform Supplier Dubai',
    description: 'Bulk workwear and industrial uniforms in Dubai: pant-and-shirt sets, coveralls and cargo trousers with company branding, size planning and UAE delivery.',
    intro: 'Order coordinated workwear for construction, maintenance, logistics and facilities teams. Browse pant-and-shirt sets, coveralls, cargo trousers and related industrial uniforms with bulk sizing and optional branding.',
    guide: 'The right uniform depends on the job, fabric weight, climate, movement and visibility requirements. Lighter fabrics can improve comfort for routine indoor work, while heavier twill and cotton options provide more structure for demanding site use. Reflective configurations support visibility but should be selected against the employer’s risk assessment. Plan sizes from an actual staff list instead of estimating one average size. For branded uniforms, Xpertone Creative LLC-FZ can review DTF, heat-transfer or embroidery requirements according to the garment and artwork. Confirm logo position, colour and finished dimensions before production. Product pages show available sizes and current guide prices; final specifications, artwork and delivery timing are confirmed with the order.',
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
    guide: 'Select gloves for the actual hazard rather than by colour or general appearance. Grip, dexterity, coating, cuff, liner and resistance level affect where a glove is appropriate. Welding gloves, coated handling gloves and cut-focused gloves are designed for different tasks and should not be treated as interchangeable. Use the product specification and any verified standard shown on the page, then confirm suitability through your workplace risk assessment. Hand protection follows the normal ecommerce flow without logo customization: choose the available size or unit, enter the required quantity and add the item to the cart. Contact Xpertone Creative LLC-FZ when you need a mixed glove order or help locating a specific verified rating.',
    faq: [['Which glove should I choose?', 'Choose according to the hazard, required dexterity, grip and verified resistance information for the product.'], ['Are gloves customizable?', 'No. Hand-protection products use the standard ecommerce ordering flow.'], ['Can you source a particular glove type?', 'Yes. Send the required material, standard, size range and quantity to the sales team.']]
  }
};

const workwearFamilies = [
  ['35-65-coverall-without-reflector', '35/65 Coverall Without Reflector', '35/65 poly-cotton', 'coverall', false],
  ['35-65-coverall-with-reflector', '35/65 Coverall With Reflector', '35/65 poly-cotton', 'coverall', true],
  ['35-65-pant-shirt-without-reflector', '35/65 Pant & Shirt Without Reflector', '35/65 poly-cotton', 'pant-and-shirt', false],
  ['35-65-pant-shirt-with-reflector', '35/65 Pant & Shirt With Reflector', '35/65 poly-cotton', 'pant-and-shirt', true],
  ['100-twill-coverall-without-reflector', '100% Twill Coverall Without Reflector', '100% twill', 'coverall', false],
  ['100-twill-coverall-with-reflector', '100% Twill Coverall With Reflector', '100% twill', 'coverall', true],
  ['100-twill-pant-shirt-without-reflector', '100% Twill Pant & Shirt Without Reflector', '100% twill', 'pant-and-shirt', false],
  ['100-twill-pant-shirt-with-reflector', '100% Twill Pant & Shirt With Reflector', '100% twill', 'pant-and-shirt', true],
  ['100-cotton-coverall-without-reflector', '100% Cotton Coverall Without Reflector', '100% cotton', 'coverall', false],
  ['100-cotton-coverall-with-reflector', '100% Cotton Coverall With Reflector', '100% cotton', 'coverall', true],
  ['100-cotton-pant-shirt-without-reflector', '100% Cotton Pant & Shirt Without Reflector', '100% cotton', 'pant-and-shirt', false],
  ['100-cotton-pant-shirt-with-reflector', '100% Cotton Pant & Shirt With Reflector', '100% cotton', 'pant-and-shirt', true]
].map(([slug, name, material, garment, reflective]) => ({ slug, name, material, garment, reflective, core: true }));

const extraWorkwearFamilies = [
  ['fire-retardant-coveralls', 'Fire Retardant Coveralls', /(?:fire\s*retardant|\bfr\b|\bifr\b|aramid|proban|arc flash|welding).*coverall|coverall.*(?:fire\s*retardant|\bfr\b|\bifr\b|aramid|proban|arc flash|welding)/i],
  ['fire-retardant-pant-shirt', 'Fire Retardant Pant & Shirt', /(?:fire\s*retardant|\bfr\b|\bifr\b|aramid|proban|arc flash|welding).*(?:pant|shirt)|(?:pant|shirt).*(?:fire\s*retardant|\bfr\b|\bifr\b|aramid|proban|arc flash|welding)/i],
  ['disposable-coveralls', 'Disposable Coveralls', /disposable.*coverall|coverall.*disposable|microporous.*coverall/i],
  ['lab-coats', 'Lab Coats', /lab\s*coat/i],
  ['cargo-pants', 'Cargo Pants', /cargo\s*(?:pant|trouser)/i],
  ['work-jackets-trouser-sets', 'Work Jackets & Trouser Sets', /winter\s*jacket|jacket\s*(?:&|and)\s*trouser|trouser\s*set/i],
  ['specialist-coveralls', 'Specialist Protective Coveralls', /coverall|bib\s*overall|chemical\s*suit|fire\s*fighting\s*suit/i],
  ['other-pant-shirt-sets', 'Other Pant & Shirt Sets', /pant\s*(?:&|and)?\s*shirt|pant\s+shirt|shirt\s*(?:&|and)\s*pant/i],
  ['workwear-trousers-pants', 'Workwear Trousers & Pants', /\bpant\b|\btrouser\b/i],
  ['workwear-accessories', 'Workwear Accessories', /fire\s*fighter\s*hood/i]
].map(([slug, name, matcher]) => ({ slug, name, matcher, material: 'Additional workwear range', core: false }));
workwearFamilies.push(...extraWorkwearFamilies);

const safetyVestFamilies = [
  { slug: 'general-vests', name: 'General Safety Vests', label: 'Under AED 15', thumbnail: '/assets/img/category/safety-vests/general-vests.webp', description: 'Affordable safety vests for visitors, general crews and short-duration site use.' },
  { slug: 'supervisor-vests', name: 'Supervisor Safety Vests', label: 'AED 15–20', thumbnail: '/assets/img/category/safety-vests/supervisor-vests.webp', description: 'Supervisor vests with practical closures, pockets and enhanced site visibility.' },
  { slug: 'engineer-management-vests', name: 'Engineer & Management Safety Vests', label: 'Above AED 20', thumbnail: '/assets/img/category/safety-vests/engineer-management-vests.webp', description: 'Premium vest options suited to engineers, managers and senior site personnel.' },
  [`${origin}/blog/`, 'weekly', '0.7']
];

const handProtectionFamilies = [
  { slug: 'cut-resistant-gloves', name: 'Cut-Resistant Gloves', description: 'Gloves designed for tasks requiring verified cut-resistance construction and coated grip.' },
  { slug: 'nitrile-coated-gloves', name: 'Nitrile-Coated Gloves', description: 'General handling gloves with nitrile foam, flat or micro-foam palm coatings.' },
  { slug: 'latex-rubber-coated-gloves', name: 'Latex & Rubber-Coated Gloves', description: 'Latex and rubber-coated gloves for grip-focused handling and general site work.' },
  { slug: 'leather-driving-welding-gloves', name: 'Leather, Driving & Welding Gloves', description: 'Leather gloves for driving, fabrication, welding and heavy-duty handling tasks.' },
  { slug: 'cotton-knitted-heat-resistant-gloves', name: 'Cotton, Knitted & Heat-Resistant Gloves', description: 'Cotton and knitted gloves, including hot-mill styles for suitable heat-handling work.' },
  { slug: 'impact-anti-vibration-gloves', name: 'Impact & Anti-Vibration Gloves', description: 'Specialist gloves for mechanical impact protection and vibration-intensive work.' },
  { slug: 'chemical-pvc-long-cuff-gloves', name: 'Chemical, PVC & Long-Cuff Gloves', description: 'Long-cuff, PVC, nitrile and latex styles intended for chemical or wet handling applications.' },
  { slug: 'disposable-examination-gloves', name: 'Disposable & Examination Gloves', description: 'Single-use examination gloves for hygiene-sensitive and general disposable applications.' }
];
const handProtectionSkuGroups = new Map(Object.entries({
  'cut-resistant-gloves': ['ACM','ANZ','JNU','LBG','LOL','RUB72','SAO','SEG','YES'],
  'nitrile-coated-gloves': ['CAB','KTP','NBR','ORD','USA'],
  'latex-rubber-coated-gloves': ['DRC','DSC','MWC','PEV','RGS','USC','WRY'],
  'leather-driving-welding-gloves': ['BAK','DPX','EGY','GKR','HJO','IJT10','SAF','TZA','UKP'],
  'cotton-knitted-heat-resistant-gloves': ['BCK60','CKG','LHE','PCR','RTP','PMI'],
  'impact-anti-vibration-gloves': ['AFH','MOK','QUV','UFO'],
  'chemical-pvc-long-cuff-gloves': ['JKL','LLR','MLX','NEP','PLR','TNC'],
  'disposable-examination-gloves': ['JWM']
}).flatMap(([slug, skus]) => skus.map(sku => [sku, slug])));

function handProtectionFamily(p) {
  const slug = handProtectionSkuGroups.get(String(p.sku || '').toUpperCase());
  return handProtectionFamilies.find(family => family.slug === slug) || null;
}

const safetyShoeFamilies = [
  { slug: 'low-ankle-safety-shoes', name: 'Low-Ankle Safety Shoes', description: 'Low-cut protective footwear for mobility, routine site work, warehouses and workshops.' },
  { slug: 'high-ankle-safety-boots', name: 'High-Ankle Safety Boots', description: 'Higher-cut safety footwear offering additional ankle coverage for demanding work environments.' },
  { slug: 'executive-slip-on-safety-shoes', name: 'Executive & Slip-On Safety Shoes', description: 'Smart, sporty and easy-on safety footwear for supervisors, facilities teams and indoor work.' },
  { slug: 'rigger-safety-boots', name: 'Rigger Safety Boots', description: 'Pull-on leather rigger boots for construction, industrial and heavy-duty site applications.' },
  { slug: 'safety-gumboots-rain-boots', name: 'Safety Gumboots & Rain Boots', description: 'Water-resistant gumboots and rain boots, including steel-toe and plate options where stated.' },
  { slug: 'kitchen-anti-slip-clogs', name: 'Kitchen & Anti-Slip Clogs', description: 'Waterproof and slip-resistant clogs for kitchens, food service and wet indoor workplaces.' },
  { slug: 'general-protective-footwear', name: 'General Protective Footwear', description: 'Additional protective footwear models where a specific ankle or closure style is not stated.' }
];
const safetyShoeSkuGroups = new Map(Object.entries({
  'low-ankle-safety-shoes': ['DJG','QKM','CMG','GQF','SOH','VE25','VE12','SGM','DVR','AMJ','NBI','SEU','PEN','AIO','JJO','VIM'],
  'high-ankle-safety-boots': ['VOA','OXP','LMV','RKP','RSC','SKNS','PRI','MFC','SGB','SGK','VBL','MDU','LEO','SG6','VJS6','SG7','USB','SHP'],
  'executive-slip-on-safety-shoes': ['VI8','VE7','VE5','VE3','VE1','PMC','RUQ','VTI','MKN','PUR','HOF','JPU'],
  'rigger-safety-boots': ['YRA','UBA'],
  'safety-gumboots-rain-boots': ['RBS12','RBT','JGP','PKN'],
  'kitchen-anti-slip-clogs': ['DHA'],
  'general-protective-footwear': ['GOP','PAS','LBW','FAR','PAM','PDH','YAK','RBK']
}).flatMap(([slug, skus]) => skus.map(sku => [sku, slug])));

function safetyShoeFamily(p) {
  const slug = safetyShoeSkuGroups.get(String(p.sku || '').toUpperCase());
  return safetyShoeFamilies.find(family => family.slug === slug) || null;
}

const headProtectionFamilies = [
  { slug: 'industrial-safety-helmets', name: 'Industrial Safety Helmets', description: 'Protective site helmets with plastic, textile, ratchet and ventilated suspension options.' },
  { slug: 'bump-caps', name: 'Bump Caps', description: 'Lightweight bump caps for low-risk indoor environments where industrial safety helmets are not required.' },
  { slug: 'face-shields-windows', name: 'Face Shields & Windows', description: 'Face-shield assemblies, frames and replacement windows for compatible workplace protection systems.' },
  { slug: 'welding-helmets', name: 'Welding Helmets', description: 'Purpose-built welding head and face protection for compatible welding applications.' },
  { slug: 'full-brim-headwear', name: 'Full-Brim Protective Headwear', description: 'Full-brim protective headwear for outdoor visibility and broader coverage.' },
  { slug: 'helmet-accessories', name: 'Helmet Accessories', description: 'Compatible helmet accessories such as chin straps and suspension-related components.' }
];
const headProtectionSkuGroups = new Map(Object.entries({
  'industrial-safety-helmets': ['ABU','LGB','ORT','VH','VHRT','VHT','VHV','VHVR'],
  'bump-caps': ['ADC','CDA','ESO','JHM','KEH'],
  'face-shields-windows': ['GOA','KPY','MRO'],
  'welding-helmets': ['PNB'],
  'full-brim-headwear': ['YOL'],
  'helmet-accessories': ['ACB']
}).flatMap(([slug, skus]) => skus.map(sku => [sku, slug])));

function headProtectionFamily(p) {
  const slug = headProtectionSkuGroups.get(String(p.sku || '').toUpperCase());
  return headProtectionFamilies.find(family => family.slug === slug) || null;
}

const eyeFaceFamilies = [
  { slug: 'safety-spectacles', name: 'Safety Spectacles', description: 'General-purpose protective spectacles for workplace eye protection and everyday site use.' },
  { slug: 'anti-fog-safety-spectacles', name: 'Anti-Fog Safety Spectacles', description: 'Protective spectacles with stated anti-fog coatings for humid or changing-temperature workplaces.' },
  { slug: 'safety-goggles', name: 'Safety Goggles', description: 'Enclosed protective goggles for dust, particles and other applications stated on each product page.' },
  { slug: 'specialty-lens-eyewear', name: 'Specialty Lens Eyewear', description: 'Protective eyewear with polarized, indoor-outdoor or other specifically stated lens treatments.' },
  { slug: 'eyewear-accessories', name: 'Eyewear Accessories', description: 'Compatible cords and accessories for suitable protective eyewear.' }
];
const eyeFaceSkuGroups = new Map(Object.entries({
  'anti-fog-safety-spectacles': ['AFC','KAL','V100','V101','V103','V104','V107','V110','V121','V181','V191','V201','V51','V702','V72','V83'],
  'safety-goggles': ['CGO','CHR','V351'],
  'specialty-lens-eyewear': ['V49','V73','V771'],
  'eyewear-accessories': ['CORD2'],
  'safety-spectacles': ['B661','B671','KMS','KPB','M091','THB','V01','V02','V131','V19','V30','V406','V46','V61','V69','V701','V71','V81','V89','V901','V91']
}).flatMap(([slug, skus]) => skus.map(sku => [sku, slug])));
function eyeFaceFamily(p) {
  const slug = eyeFaceSkuGroups.get(String(p.sku || '').toUpperCase());
  return eyeFaceFamilies.find(family => family.slug === slug) || null;
}

const hearingRespiratoryFamilies = [
  { slug: 'disposable-respirators-dust-masks', name: 'Disposable Respirators & Dust Masks', description: 'Disposable FFP2, KN95, cup-style and dust-mask options for their stated applications.' },
  { slug: 'reusable-half-masks', name: 'Reusable Half Masks', description: 'Reusable industrial half-mask respirators for use with verified compatible filters or cartridges.' },
  { slug: 'respirator-filters-cartridges', name: 'Respirator Filters & Cartridges', description: 'Replacement filters and cartridges for verified compatible respirator systems.' },
  { slug: 'earplugs', name: 'Earplugs', description: 'Corded, uncorded and disposable earplugs for workplace hearing protection.' },
  { slug: 'earmuffs', name: 'Earmuffs', description: 'Over-ear hearing protection with the stated attenuation and wearing configuration.' }
];
const hearingRespiratorySkuGroups = new Map(Object.entries({
  'disposable-respirators-dust-masks': ['BPK','CAT','FUN','HIT','MAP','QBP','V-CN95','VMK'],
  'reusable-half-masks': ['HFM'],
  'respirator-filters-cartridges': ['ABH','COP','HRK','RKV'],
  'earplugs': ['HND','LUC','USD','VPC','VPU'],
  'earmuffs': ['NDG']
}).flatMap(([slug, skus]) => skus.map(sku => [sku, slug])));
function hearingRespiratoryFamily(p) {
  const slug = hearingRespiratorySkuGroups.get(String(p.sku || '').toUpperCase());
  return hearingRespiratoryFamilies.find(family => family.slug === slug) || null;
}

const trafficSafetyFamilies = [
  { slug: 'traffic-cones-posts', name: 'Traffic Cones & Posts', thumbnail: '/assets/img/category/traffic-safety/traffic-cones-posts.png', description: 'Traffic cones, delineator posts and reflective road posts for temporary traffic control and site routing.' },
  { slug: 'traffic-warning-lights', name: 'Traffic Warning & Solar Lights', thumbnail: '/assets/img/category/traffic-safety/traffic-warning-lights.png', description: 'Solar and LED warning lights for traffic cones, barriers and temporary road-safety installations.' },
  { slug: 'traffic-batons', name: 'Traffic Batons', thumbnail: '/assets/img/category/traffic-safety/traffic-batons.png', description: 'Handheld illuminated traffic batons for marshals, parking teams and controlled vehicle movement.' },
  { slug: 'barrier-mesh-fencing', name: 'Barrier Mesh & Safety Fencing', thumbnail: '/assets/img/category/traffic-safety/barrier-mesh-fencing.png', description: 'High-visibility mesh and temporary fencing for work-zone boundaries, crowd guidance and restricted areas.' }
];
const trafficSafetySkuGroups = new Map(Object.entries({
  'traffic-cones-posts': ['TAC','UDP','WPN'],
  'traffic-warning-lights': ['S1359B','S1325','S1317','S1317RED'],
  'traffic-batons': ['ISO','PKA','ROJ'],
  'barrier-mesh-fencing': ['HVK','MSO']
}).flatMap(([slug, skus]) => skus.map(sku => [sku, slug])));
function trafficSafetyFamily(p) {
  const slug = trafficSafetySkuGroups.get(String(p.sku || '').toUpperCase());
  return trafficSafetyFamilies.find(family => family.slug === slug) || null;
}

const hardwareToolFamilies = [
  { slug: 'hammers-striking-tools', name: 'Hammers & Striking Tools', thumbnail: '/assets/img/category/hardware-tools/hammers-striking-tools.png', description: 'Machinist, claw, chipping and sledge hammers for workshop, construction and maintenance work.' },
  { slug: 'cutting-saw-blades', name: 'Cutting & Saw Blades', thumbnail: '/assets/img/category/hardware-tools/cutting-saw-blades.png', description: 'Diamond and TCT cutting blades for compatible workshop and construction equipment.' },
  { slug: 'fire-blankets', name: 'Fire Blankets', thumbnail: '/assets/img/category/hardware-tools/fire-blankets.png', description: 'Fire blankets in multiple sizes for suitable emergency response points and workplace installations.' },
  { slug: 'warning-reflective-tapes-chains', name: 'Warning Tapes, Reflective Tapes & Chains', thumbnail: '/assets/img/category/hardware-tools/warning-reflective-tapes-chains.png', description: 'Printed warning tapes, reflective tapes and plastic chains for marking hazards and controlled areas.' },
  { slug: 'scaffolding-tags', name: 'Scaffolding Tags', thumbnail: '/assets/img/category/hardware-tools/scaffolding-tags.png', description: 'Scaffolding tag holders and marker sets for inspection-status identification on compatible systems.' },
  { slug: 'lifting-lashing-equipment', name: 'Lifting & Lashing Equipment', thumbnail: '/assets/img/category/hardware-tools/lifting-lashing-equipment.png', description: 'Cargo lashing and polyester webbing slings for compatible load-control and material-handling tasks.' },
  { slug: 'spill-waste-management', name: 'Spill & Waste Management', thumbnail: '/assets/img/category/hardware-tools/spill-waste-management.png', description: 'Absorbent and disposal products for routine workplace spill response and waste handling.' },
  { slug: 'site-utility-supplies', name: 'Site Utility Supplies', thumbnail: '/assets/img/category/hardware-tools/site-utility-supplies.png', description: 'Additional site and workforce utility products used across construction and industrial workplaces.' }
];
const hardwareToolSkuGroups = new Map(Object.entries({
  'hammers-striking-tools': ['EAO','BDQ','VVL','ESN','IAV','PSC','QER','JOK'],
  'cutting-saw-blades': ['DMD','TCT','TCB'],
  'fire-blankets': ['FB1240','FB12.1830','FB18'],
  'warning-reflective-tapes-chains': ['SEP','FAB','HED','RGO','RGG','RFC','KDL','NGR'],
  'scaffolding-tags': ['ADD','JCR'],
  'lifting-lashing-equipment': ['HHR','RAB'],
  'spill-waste-management': ['OVP','PMM'],
  'site-utility-supplies': ['SOR']
}).flatMap(([slug, skus]) => skus.map(sku => [sku, slug])));
function hardwareToolFamily(p) {
  const slug = hardwareToolSkuGroups.get(String(p.sku || '').toUpperCase());
  return hardwareToolFamilies.find(family => family.slug === slug) || null;
}
const supervisorVestSkus = new Set(['ICS', 'GSO', 'LVS', 'FAT']);
const generalVestSkus = new Set(['BUP', 'IFS', 'RSJ', 'VOS']);

function safetyVestFamily(p) {
  if (supervisorVestSkus.has(String(p.sku).toUpperCase())) return safetyVestFamilies[1];
  if (generalVestSkus.has(String(p.sku).toUpperCase())) return safetyVestFamilies[0];
  if (Number(p.price) < 15) return safetyVestFamilies[0];
  if (Number(p.price) <= 20) return safetyVestFamilies[1];
  return safetyVestFamilies[2];
}

function workwearFamily(p) {
  const title = clean(p.title);
  if (/\bvest\b/i.test(title)) return null;
  const text = clean(`${p.title} ${p.material}`).toLowerCase();
  const specialist = extraWorkwearFamilies.slice(0, 6).find(x => x.matcher.test(title));
  if (specialist) return specialist;
  const material = /(?:35\s*\/\s*65|65\s*\/\s*35|35%\s*polyester[^.]{0,40}65%\s*cotton|65%\s*polyester[^.]{0,40}35%\s*cotton)/i.test(text)
    ? '35/65 poly-cotton'
    : /100\s*%\s*(?:polyester\s*)?twill/i.test(text) ? '100% twill'
    : /100\s*%\s*cotton/i.test(text) ? '100% cotton' : null;
  const garment = /pant\s*(?:&|and)?\s*shirt|pant\s+shirt|shirt\s*(?:&|and)\s*pant/i.test(text)
    ? 'pant-and-shirt' : /coverall/i.test(text) ? 'coverall' : null;
  const reflective = /reflect(?:ive|or|orized)|hi[- ]?vis/i.test(text);
  const core = workwearFamilies.find(x => x.core && x.material === material && x.garment === garment && x.reflective === reflective);
  if (core) return core;
  return extraWorkwearFamilies.slice(6).find(x => x.matcher.test(title)) || null;
}

const colourOf = p => clean(p.colour || (p.title.match(/(?:,|-)\s*([^,]+?)\s+colou?r\b/i)?.[1] || '') || 'See product');

const categoryNames = {
  'eye-face-protection': 'Eye & Face Protection',
  'hand-protection': 'Hand Protection',
  'safety-shoes': 'Safety Shoes',
  helmets: 'Head Protection',
  'traffic-safety': 'Traffic & Road Safety',
  'hardware-tools': 'Hardware - Tools'
};

function correctMisfiledSafetyVest(p) {
  if (p.category !== 'safety-vests' || /\bvest\b/i.test(p.title)) return null;
  const text = clean(`${p.title} ${p.subcategory || ''}`);
  if (/spectacle|goggle|eyewear|face\s*shield/i.test(text)) return 'eye-face-protection';
  if (/glove/i.test(text)) return 'hand-protection';
  if (/safety\s*shoe|protective\s*footwear|\bfootwear\b/i.test(text)) return 'safety-shoes';
  if (/helmet|hard\s*hat/i.test(text)) return 'helmets';
  if (/traffic|warning\s*(?:light|tape)|solar\s*warning|baton\s*light/i.test(text)) return 'traffic-safety';
  return 'hardware-tools';
}

const defaultCategoryCopy = (name, count) => ({
  title: `${name} Supplier Dubai & UAE`,
  description: `Shop ${name.toLowerCase()} from Xpertone Creative LLC-FZ in Dubai. Compare ${count} stocked products, sizes, specifications and bulk pricing for UAE delivery.`,
  intro: `Browse ${name.toLowerCase()} for construction, industrial, logistics and facilities requirements. Product pages show current stock details, available units and verified specifications.`,
  guide: `Choose products by the intended task and the verified specification shown on each item page. Do not rely only on colour, appearance or a general category label when a standard or protective rating is required. Xpertone Creative LLC-FZ supplies customers from Al Quoz, Dubai, and delivers throughout the UAE. These items follow a normal ecommerce ordering flow: select the required unit or size, enter the quantity and add the product to the cart. For project quantities or an item not listed, send the technical requirement and required delivery date to the sales team for review.`,
  faq: [['Can I order online?', 'Yes. Select the quantity on the product page and add the item directly to the cart.'], ['Is logo customization available?', 'Logo and text customization is limited to safety vests, workwear uniforms and eligible helmets.'], ['Do you deliver across the UAE?', 'Yes. Delivery is available across the Emirates, subject to stock and order confirmation.']]
});

function normalise(p) {
  const item = {
    ...p,
    uid: uid(p),
    categoryName: p.category_name,
    priceStatus: p.price_is_fixed ? 'fixed' : 'indicative',
    images: Array.isArray(p.images) ? p.images.map(image => String(image || '').replace(/(\/assets\/img\/products\/[^?#]+)\.png(?=([?#]|$))/i, '$1.webp')) : [],
    sizes: Array.isArray(p.sizes) ? p.sizes : []
  };
  if (workwearFamily(item)) {
    item.category = 'uniforms';
    item.categoryName = 'Workwear & Uniforms';
  } else {
    const correctedCategory = correctMisfiledSafetyVest(item);
    if (correctedCategory) {
      item.category = correctedCategory;
      item.categoryName = categoryNames[correctedCategory];
    }
  }
  if (item.category === 'hand-protection') {
    const family = handProtectionFamily(item);
    if (family) item.subcategory = family.name;
  }
  if (item.category === 'safety-shoes') {
    const family = safetyShoeFamily(item);
    if (family) item.subcategory = family.name;
  }
  if (item.category === 'helmets') {
    const family = headProtectionFamily(item);
    if (family) item.subcategory = family.name;
  }
  if (item.category === 'eye-face-protection') {
    const family = eyeFaceFamily(item);
    if (family) item.subcategory = family.name;
  }
  if (item.category === 'hearing-respiratory') {
    const family = hearingRespiratoryFamily(item);
    if (family) item.subcategory = family.name;
  }
  if (item.category === 'traffic-safety') {
    const family = trafficSafetyFamily(item);
    if (family) item.subcategory = family.name;
  }
  if (item.category === 'hardware-tools') {
    const family = hardwareToolFamily(item);
    if (family) item.subcategory = family.name;
  }
  return item;
}

const list = products.map(normalise).filter(p => p.slug && p.category && p.title && p.in_stock !== false);
const groups = new Map();
for (const p of list) {
  if (!groups.has(p.category)) groups.set(p.category, []);
  groups.get(p.category).push(p);
}

function metaDescription(p) {
  const facts = [p.description, p.material, p.colour, p.standard].map(clean).filter(Boolean);
  const base = facts.join('. ') || `${p.title} available for bulk supply from Xpertone Creative LLC-FZ in Dubai.`;
  const text = clean(`${base} Compare available sizes and order for UAE delivery.`);
  return text.length > 158 ? `${text.slice(0, 155).replace(/\s+\S*$/, '')}...` : text;
}

function staticProductBody(p) {
  const image = p.images[0];
  const description = clean(p.description || p.features?.[0] || `${p.title} supplied for trade and project orders in Dubai and across the UAE.`);
  const specs = [
    ['SKU', p.sku], ['Unit of sale', saleUnitLabel(p)], ['Material', p.material], ['Colour', p.colour], ['Standard', p.standard],
    ['Origin', p.origin], ['Packing', p.packing], ['Available sizes', p.sizes.join(', ')]
  ].filter(([, v]) => clean(v));
  return `<nav aria-label="Breadcrumb" class="mb-3" style="font-size:.85rem"><a href="/">Home</a> / <a href="/category/${esc(p.category)}/">${esc(p.categoryName)}</a> / <span>${esc(p.title)}</span></nav>
  <div class="row g-4 g-lg-5">
    <div class="col-lg-6"><div class="gallery__main">${image ? `<img src="${esc(image)}" alt="${esc(p.title)}" width="800" height="800" decoding="async">` : ''}</div></div>
    <div class="col-lg-6"><span class="product-card__cat">${esc(p.categoryName)}</span><h1 class="mt-1">${esc(p.title)}</h1>
      ${p.sku ? `<p class="product-sku">SKU: <strong>${esc(p.sku)}</strong></p>` : ''}
      ${p.subtitle ? `<p class="text-muted-xo">${esc(p.subtitle)}</p>` : ''}
      <p><strong>${money(p.price)}</strong> per ${esc(saleUnit(p))}, excluding VAT${p.priceStatus === 'indicative' ? ' - indicative and confirmed on quotation' : ''}.</p>
      <p>${esc(description)}</p>
      <p><a class="btn btn-xo" href="/product.html?p=${encodeURIComponent(p.uid)}">Choose sizes and order</a></p>
      <ul class="spec-list">${specs.map(([k, v]) => `<li><b>${esc(k)}</b><span>${esc(v)}</span></li>`).join('')}</ul>
    </div>
  </div>
  <section class="mt-5" aria-labelledby="product-ordering-guide"><h2 id="product-ordering-guide">Ordering ${esc(p.title)} in the UAE</h2><p>Review the product description, available options, unit of sale and current stock information before ordering. Protective equipment must be selected for the actual workplace hazard and should not be chosen by appearance alone. Where a safety standard, performance rating or compatibility requirement applies, confirm that the specification shown for this exact SKU matches your company risk assessment.</p><p>Xpertone Creative supplies trade and project orders from Al Quoz, Dubai, with delivery available across the UAE. For mixed quantities or a technical requirement, send the SKU, required quantity, delivery location and required date to our sales team. You can also <a href="/category/${esc(p.category)}/">compare more ${esc(p.categoryName.toLowerCase())}</a>, <a href="/shop.html">browse the complete product catalogue</a>, use the <a href="/sitemap.html">HTML catalogue index</a>, or <a href="/contact.html#quote">request a quotation</a>.</p></section>`;
}

function productSeoTitle(p) {
  const suffix = ' | Xpertone Dubai';
  const limit = 60 - suffix.length;
  const source = clean(p.title);
  if (source.length <= limit) return `${source}${suffix}`;
  const shortened = source.slice(0, limit + 1).replace(/\s+\S*$/, '').replace(/[,:;\s-]+$/, '');
  return `${shortened}${suffix}`;
}

function productSchema(p) {
  const schema = {
    '@context': 'https://schema.org', '@type': 'Product', name: p.title,
    description: metaDescription(p), sku: p.sku, image: p.images,
    brand: { '@type': 'Brand', name: 'Xpertone Creative LLC-FZ' },
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
    .replace('<title>Product — Xpertone Creative LLC-FZ</title>', `<title>${esc(productSeoTitle(p))}</title>`)
    .replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${esc(description)}">\n<link rel="canonical" href="${canonical}">\n<meta property="og:type" content="product">\n<meta property="og:title" content="${esc(p.title)}">\n<meta property="og:description" content="${esc(description)}">\n<meta property="og:url" content="${canonical}">\n<meta property="og:image" content="${esc(image)}">\n<script type="application/ld+json" data-static-product-schema>${JSON.stringify(productSchema(p))}</script>\n<script type="application/ld+json">${JSON.stringify(breadcrumb)}</script>`)
    .replace('<meta name="robots" content="noindex,follow">', '<meta name="robots" content="index,follow">')
    .replace(/<script src="assets\/js\/config\.js(?:\?v=[^"]+)?"><\/script>/,
      match => `<script>window.XO_STATIC_PRODUCT_UID=${JSON.stringify(p.uid)};</script>\n${match}`);
  const pdpStart = html.indexOf('<div class="container py-4" id="pdp">');
  const relatedStart = html.indexOf('  <section class="section section--alt" id="relatedWrap"', pdpStart);
  if (pdpStart < 0 || relatedStart < 0) throw new Error(`Product template markers missing for ${p.uid}`);
  html = `${html.slice(0, pdpStart)}<div class="container py-4" id="pdp">${staticProductBody(p)}</div>\n\n${html.slice(relatedStart)}`;
  write(path.join(root, 'products', p.slug, 'index.html'), html);
}

function productCard(p) {
  const image = p.images[0];
  return `<div class="col-6 col-lg-4 col-xl-3"><article class="product-card"><a class="product-card__media" href="/products/${encodeURIComponent(p.slug)}/">${image ? `<img src="${esc(image)}" alt="${esc(p.title)}" loading="lazy" decoding="async" width="600" height="600">` : ''}</a><div class="product-card__body"><span class="product-card__cat">${esc(p.subcategory || p.categoryName)}</span>${p.sku ? `<div class="product-card__sku">SKU: ${esc(p.sku)}</div>` : ''}<h3 class="product-card__title"><a href="/products/${encodeURIComponent(p.slug)}/">${esc(p.title)}</a></h3><div class="product-card__foot"><div class="product-card__price"><b>${money(p.price)}</b><span>${p.priceStatus === 'fixed' ? `per ${esc(saleUnit(p))}, ex VAT` : `indicative per ${esc(saleUnit(p))}, ex VAT`}</span></div><a class="btn btn-xo btn-sm-xo" href="/products/${encodeURIComponent(p.slug)}/">View</a></div></div></article></div>`;
}

const thumbnailCategories = new Set([
  'uniforms', 'safety-vests', 'hand-protection', 'safety-shoes', 'helmets',
  'eye-face-protection', 'hearing-respiratory', 'traffic-safety', 'hardware-tools'
]);

function familyThumbnailAsset(categorySlug, family, items) {
  if (!items.length || !thumbnailCategories.has(categorySlug)) return '';
  const imagePath = `/assets/img/category/${categorySlug}/${family.slug}.png`;
  const filePath = path.join(root, 'assets', 'img', 'category', categorySlug, `${family.slug}.svg`);
  const selectedItems = items.slice(0, 1);
  const boxes = [[112, 102, 800, 800]];
  const productImages = selectedItems.map((product, index) => {
    const [x, y, width, height] = boxes[index];
    if (!product.images?.[0]) return '';
    const pathname = new URL(product.images[0], origin).pathname.replace(/^\//, '');
    const localFile = path.join(root, ...pathname.split('/'));
    let source = product.images[0];
    if (fs.existsSync(localFile)) {
      const extension = path.extname(localFile).slice(1).toLowerCase();
      const mime = extension === 'jpg' || extension === 'jpeg' ? 'image/jpeg' : extension === 'png' ? 'image/png' : 'image/webp';
      source = `data:${mime};base64,${fs.readFileSync(localFile).toString('base64')}`;
    }
    return `<image href="${esc(source)}" x="${x}" y="${y}" width="${width}" height="${height}" preserveAspectRatio="xMidYMid meet"/>`;
  }).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024"><defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#f2f4f7"/></linearGradient><radialGradient id="halo"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#eef1f5"/></radialGradient></defs><rect width="1024" height="1024" fill="url(#bg)"/><circle cx="798" cy="176" r="270" fill="#e8edf3" opacity=".58"/><circle cx="154" cy="860" r="230" fill="#efe9dc" opacity=".52"/><ellipse cx="512" cy="506" rx="430" ry="412" fill="url(#halo)"/><path d="M72 72h108" stroke="#c8a24b" stroke-width="8" stroke-linecap="round"/><path d="M844 952h108" stroke="#0a274d" stroke-width="8" stroke-linecap="round"/>${productImages}</svg>`;
  write(filePath, svg);
  return `${imagePath}?v=20260916premium`;
}
function workwearFamilyPage(family, items) {
  const canonical = workwearUrl(family.slug);
  const colours = [...new Set(items.map(colourOf).filter(Boolean))];
  const description = `Shop ${family.name.toLowerCase()} in Dubai and across the UAE. Compare ${colours.length} colour variation${colours.length === 1 ? '' : 's'}, sizes, prices and stock for bulk workwear orders.`;
  const itemList = {
    '@context': 'https://schema.org', '@type': 'ItemList', name: family.name,
    itemListElement: items.map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: productUrl(p), name: p.title }))
  };
  const breadcrumb = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: `${origin}/` },
    { '@type': 'ListItem', position: 2, name: 'Workwear & Uniforms', item: categoryUrl('uniforms') },
    { '@type': 'ListItem', position: 3, name: family.name, item: canonical }
  ]};
  const chips = colours.map(c => `<span class="workwear-colour">${esc(c)}</span>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><base href="/"><title>${esc(family.name)} Dubai & UAE | Xpertone Creative LLC-FZ</title><meta name="description" content="${esc(description)}"><link rel="canonical" href="${canonical}">${items.length ? '' : '<meta name="robots" content="noindex,follow">'}<meta property="og:type" content="website"><meta property="og:title" content="${esc(family.name)} Dubai & UAE"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${canonical}"><meta property="og:image" content="${origin}/assets/img/brand/og-xpertone.png"><link rel="icon" type="image/png" sizes="32x32" href="assets/img/brand/favicon-32.png"><link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css"><link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css"><link rel="stylesheet" href="assets/css/main.css?v=20260914sku"><script type="application/ld+json">${JSON.stringify(itemList)}</script><script type="application/ld+json">${JSON.stringify(breadcrumb)}</script></head><body data-page="shop"><a class="skip-link" href="#main">Skip to content</a><div id="siteHeader"></div><main id="main"><section class="section section--alt"><div class="container"><nav aria-label="Breadcrumb"><a href="/">Home</a> / <a href="/category/uniforms/">Workwear &amp; Uniforms</a> / <span>${esc(family.name)}</span></nav><h1 class="mt-3">${esc(family.name)} in Dubai</h1><p class="lead">Browse every currently published ${esc(family.name.toLowerCase())} product. Each colour remains available as its own selectable product with live size and stock information.</p><div class="workwear-colours" aria-label="Available colours"><strong>Available colours:</strong> ${chips || '<span>Contact us for current availability</span>'}</div><p class="mt-3">${items.length ? `${items.length} colour variation${items.length === 1 ? '' : 's'} currently available.` : 'No colour variations are published at present; contact the team for sourcing and availability.'}</p></div></section>${items.length ? `<section class="section"><div class="container"><div class="row g-4">${items.map(productCard).join('')}</div></div></section>` : ''}<section class="section section--alt"><div class="container"><h2>Bulk ${esc(family.name)} for UAE teams</h2><p>Order mixed sizes for construction, maintenance, logistics and facilities teams. Product pages show the available size split, current stock and guide price. Company logo printing can be reviewed for suitable garments before production.</p><div class="faq-grid"><article><h3>Can I order mixed sizes?</h3><p>Yes. Choose quantities against the available sizes on each colour product page.</p></article><article><h3>Can this workwear be branded?</h3><p>Eligible garments can be supplied with an approved company logo or text placement.</p></article><article><h3>Do you deliver across the UAE?</h3><p>Yes. Xpertone Creative supplies Dubai and delivers throughout the Emirates.</p></article></div></div></section></main><div id="siteFooter"></div><script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script><script src="assets/js/config.js?v=20260914sku"></script><script src="assets/js/store.js?v=20260914sku"></script><script src="assets/js/ui.js?v=20260914sku"></script></body></html>`;
}

function workwearHub(familyGroups, otherItems) {
  const available = workwearFamilies.filter(f => (familyGroups.get(f.slug) || []).length);
  const count = new Set([
    ...available.flatMap(f => familyGroups.get(f.slug).map(p => p.uid)),
    ...otherItems.map(p => p.uid)
  ]).size;
  const familyCard = f => {
    const items = familyGroups.get(f.slug) || [];
    const image = familyThumbnailAsset('uniforms', f, items) || f.thumbnail || items[0]?.images?.[0];
    return `<div class="col-md-6 col-xl-4"><article class="workwear-family-card${items.length ? '' : ' is-empty'}">${image ? `<img src="${esc(image)}" alt="${esc(f.name)}" loading="lazy" width="600" height="420">` : ''}<div><p class="workwear-family-card__eyebrow">${esc(f.material)}</p><h2>${items.length ? `<a href="/category/uniforms/${f.slug}/">${esc(f.name)}</a>` : esc(f.name)}</h2><p>${items.length ? `${items.length} colour variation${items.length === 1 ? '' : 's'} available` : 'No published colour variations at present'}</p>${items.length ? `<a class="btn btn-xo btn-sm-xo" href="/category/uniforms/${f.slug}/">View colours</a>` : ''}</div></article></div>`;
  };
  const coreCards = workwearFamilies.filter(f => f.core).map(familyCard).join('');
  const additionalCards = workwearFamilies.filter(f => !f.core && (familyGroups.get(f.slug) || []).length).map(familyCard).join('');
  const additional = additionalCards ? `<section class="section section--alt"><div class="container"><h2>Additional Workwear Categories</h2><p class="text-muted-xo">Specialist garments and supporting workwear are grouped by product type, with their colour options kept inside each range.</p><div class="row g-4">${additionalCards}</div></div></section>` : '';
  const other = otherItems.length ? `<section class="section"><div class="container"><h2>Unclassified workwear</h2><p class="text-muted-xo">These products need a clearer product name or material specification before they can be placed in a dedicated range.</p><div class="row g-4">${otherItems.map(productCard).join('')}</div></div></section>` : '';
  const canonical = categoryUrl('uniforms');
  const description = 'Shop workwear in Dubai by fabric, garment type and reflective option. Browse 35/65, 100% twill and 100% cotton coveralls and pant-and-shirt sets with colour variations.';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><base href="/"><title>Workwear by Fabric & Reflective Type Dubai | Xpertone Creative</title><meta name="description" content="${description}"><link rel="canonical" href="${canonical}"><meta property="og:type" content="website"><meta property="og:title" content="Workwear by Fabric & Reflective Type Dubai"><meta property="og:description" content="${description}"><meta property="og:url" content="${canonical}"><meta property="og:image" content="${origin}/assets/img/brand/og-xpertone.png"><link rel="icon" type="image/png" sizes="32x32" href="assets/img/brand/favicon-32.png"><link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css"><link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css"><link rel="stylesheet" href="assets/css/main.css?v=20260914sku"></head><body data-page="shop"><a class="skip-link" href="#main">Skip to content</a><div id="siteHeader"></div><main id="main"><section class="section section--alt"><div class="container"><nav aria-label="Breadcrumb"><a href="/">Home</a> / <a href="/shop.html">Shop</a> / <span>Workwear &amp; Uniforms</span></nav><h1 class="mt-3">Workwear &amp; Uniforms</h1><p class="lead">Choose by fabric, garment format and reflective requirement. Colour variations stay together inside each dedicated range.</p><p>${count} published products are available across these ranges and specialist workwear.</p></div></section><section class="section"><div class="container"><h2>Core Workwear Categories</h2><div class="row g-4">${coreCards}</div></div></section>${additional}${other}<section class="section section--alt"><div class="container"><h2>Workwear supplier in Dubai and the UAE</h2><p>Compare 35/65 poly-cotton, 100% twill and 100% cotton options for coveralls or coordinated pant-and-shirt sets. Select reflective or non-reflective construction according to the workplace requirement, then choose the preferred colour and size mix.</p></div></section></main><div id="siteFooter"></div><script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script><script src="assets/js/config.js?v=20260914sku"></script><script src="assets/js/store.js?v=20260914sku"></script><script src="assets/js/ui.js?v=20260914sku"></script></body></html>`;
}

function safetyVestFamilyPage(family, items) {
  const canonical = `${categoryUrl('safety-vests')}${family.slug}/`;
  const description = `Shop ${family.name.toLowerCase()} in Dubai and across the UAE. ${family.label} catalogue range with SKU, colour, size, stock and bulk-order information.`;
  const itemList = { '@context': 'https://schema.org', '@type': 'ItemList', name: family.name,
    itemListElement: items.map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: productUrl(p), name: p.title })) };
  const breadcrumb = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: `${origin}/` },
    { '@type': 'ListItem', position: 2, name: 'Safety Vests', item: categoryUrl('safety-vests') },
    { '@type': 'ListItem', position: 3, name: family.name, item: canonical }
  ]};
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><base href="/"><title>${esc(family.name)} Dubai & UAE | Xpertone Creative</title><meta name="description" content="${esc(description)}"><link rel="canonical" href="${canonical}"><meta property="og:type" content="website"><meta property="og:title" content="${esc(family.name)} Dubai & UAE"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${canonical}"><meta property="og:image" content="${origin}/assets/img/brand/og-xpertone.png"><link rel="icon" type="image/png" sizes="32x32" href="assets/img/brand/favicon-32.png"><link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css"><link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css"><link rel="stylesheet" href="assets/css/main.css?v=20260914sku"><script type="application/ld+json">${JSON.stringify(itemList)}</script><script type="application/ld+json">${JSON.stringify(breadcrumb)}</script></head><body data-page="shop"><a class="skip-link" href="#main">Skip to content</a><div id="siteHeader"></div><main id="main"><section class="section section--alt"><div class="container"><nav aria-label="Breadcrumb"><a href="/">Home</a> / <a href="/category/safety-vests/">Safety Vests</a> / <span>${esc(family.name)}</span></nav><h1 class="mt-3">${esc(family.name)} in Dubai</h1><p class="lead">${esc(family.description)}</p><p><strong>${esc(family.label)}</strong> · ${items.length} products currently available.</p></div></section><section class="section"><div class="container"><div class="row g-4">${items.map(productCard).join('')}</div></div></section><section class="section section--alt"><div class="container"><h2>Branded ${esc(family.name)} for UAE teams</h2><p>Choose a colour and design, then open the individual product page to confirm its SKU, sizes, stock and current price. Suitable products can be printed with an approved company logo or role title.</p></div></section></main><div id="siteFooter"></div><script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script><script src="assets/js/config.js?v=20260914sku"></script><script src="assets/js/store.js?v=20260914sku"></script><script src="assets/js/ui.js?v=20260914sku"></script></body></html>`;
}

function safetyVestHub(groups) {
  const cards = safetyVestFamilies.map(family => {
    const items = groups.get(family.slug) || [];
    const image = familyThumbnailAsset('safety-vests', family, items) || family.thumbnail || items[0]?.images?.[0];
    return `<div class="col-md-6 col-xl-4"><article class="workwear-family-card safety-vest-family-card">${image ? `<img src="${esc(image)}" alt="${esc(family.name)}" loading="lazy" width="900" height="900">` : ''}<div><p class="workwear-family-card__eyebrow">${esc(family.label)}</p><h2><a href="/category/safety-vests/${family.slug}/">${esc(family.name)}</a></h2><p>${esc(family.description)}</p><p>${items.length} products available</p><a class="btn btn-xo btn-sm-xo" href="/category/safety-vests/${family.slug}/">View products</a></div></article></div>`;
  }).join('');
  const count = safetyVestFamilies.reduce((n, family) => n + groups.get(family.slug).length, 0);
  const canonical = categoryUrl('safety-vests');
  const description = 'Shop safety vests in Dubai grouped for general workers, supervisors, engineers and management, with SKU, colour, price and bulk logo-printing details.';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><base href="/"><title>Safety Vests by Role & Price Dubai | Xpertone Creative</title><meta name="description" content="${description}"><link rel="canonical" href="${canonical}"><meta property="og:type" content="website"><meta property="og:title" content="Safety Vests by Role & Price Dubai"><meta property="og:description" content="${description}"><meta property="og:url" content="${canonical}"><meta property="og:image" content="${origin}/assets/img/brand/og-xpertone.png"><link rel="icon" type="image/png" sizes="32x32" href="assets/img/brand/favicon-32.png"><link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css"><link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css"><link rel="stylesheet" href="assets/css/main.css?v=20260914sku"></head><body data-page="shop"><a class="skip-link" href="#main">Skip to content</a><div id="siteHeader"></div><main id="main"><section class="section section--alt"><div class="container"><nav aria-label="Breadcrumb"><a href="/">Home</a> / <a href="/shop.html">Shop</a> / <span>Safety Vests</span></nav><h1 class="mt-3">Safety Vests</h1><p class="lead">Choose a vest range by role and current catalogue price. Colours and designs remain as individual products inside each dedicated range.</p><p>${count} published safety vests are available.</p></div></section><section class="section"><div class="container"><h2>Safety Vest Categories</h2><div class="row g-4">${cards}</div></div></section><section class="section section--alt"><div class="container"><h2>Safety vest printing in Dubai</h2><p>Add an approved company logo, department name or role title to suitable vest designs. Open a range to compare available colours, SKUs, sizes and current pricing.</p></div></section></main><div id="siteFooter"></div><script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script><script src="assets/js/config.js?v=20260914sku"></script><script src="assets/js/store.js?v=20260914sku"></script><script src="assets/js/ui.js?v=20260914sku"></script></body></html>`;
}

function handProtectionFamilyPage(family, items) {
  const canonical = `${categoryUrl('hand-protection')}${family.slug}/`;
  const description = `Shop ${family.name.toLowerCase()} in Dubai and across the UAE. Compare verified product details, SKUs, sizes, stock and prices for ${items.length} available gloves.`;
  const itemList = { '@context': 'https://schema.org', '@type': 'ItemList', name: family.name,
    itemListElement: items.map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: productUrl(p), name: p.title })) };
  const breadcrumb = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: `${origin}/` },
    { '@type': 'ListItem', position: 2, name: 'Hand Protection', item: categoryUrl('hand-protection') },
    { '@type': 'ListItem', position: 3, name: family.name, item: canonical }
  ]};
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><base href="/"><title>${esc(family.name)} Dubai & UAE | Xpertone Creative</title><meta name="description" content="${esc(description)}"><link rel="canonical" href="${canonical}"><meta property="og:type" content="website"><meta property="og:title" content="${esc(family.name)} Dubai & UAE"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${canonical}"><meta property="og:image" content="${origin}/assets/img/brand/og-xpertone.png"><link rel="icon" type="image/png" sizes="32x32" href="assets/img/brand/favicon-32.png"><link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css"><link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css"><link rel="stylesheet" href="assets/css/main.css?v=20260914sku"><script type="application/ld+json">${JSON.stringify(itemList)}</script><script type="application/ld+json">${JSON.stringify(breadcrumb)}</script></head><body data-page="shop"><a class="skip-link" href="#main">Skip to content</a><div id="siteHeader"></div><main id="main"><section class="section section--alt"><div class="container"><nav aria-label="Breadcrumb"><a href="/">Home</a> / <a href="/category/hand-protection/">Hand Protection</a> / <span>${esc(family.name)}</span></nav><h1 class="mt-3">${esc(family.name)} in Dubai</h1><p class="lead">${esc(family.description)}</p><p>${items.length} products currently available.</p></div></section><section class="section"><div class="container"><div class="row g-4">${items.map(productCard).join('')}</div></div></section><section class="section section--alt"><div class="container"><h2>Choosing ${esc(family.name)}</h2><p>Check the individual product page for its material, coating, cuff, size and verified resistance information. Select hand protection according to the workplace risk assessment and intended task.</p></div></section></main><div id="siteFooter"></div><script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script><script src="assets/js/config.js?v=20260914sku"></script><script src="assets/js/store.js?v=20260914sku"></script><script src="assets/js/ui.js?v=20260914sku"></script></body></html>`;
}

function handProtectionHub(groups) {
  const cards = handProtectionFamilies.map(family => {
    const items = groups.get(family.slug) || [];
    const image = familyThumbnailAsset('hand-protection', family, items) || items[0]?.images?.[0];
    return `<div class="col-md-6 col-xl-4"><article class="workwear-family-card">${image ? `<img src="${esc(image)}" alt="${esc(family.name)}" loading="lazy" width="600" height="420">` : ''}<div><p class="workwear-family-card__eyebrow">${items.length} products</p><h2><a href="/category/hand-protection/${family.slug}/">${esc(family.name)}</a></h2><p>${esc(family.description)}</p><a class="btn btn-xo btn-sm-xo" href="/category/hand-protection/${family.slug}/">View products</a></div></article></div>`;
  }).join('');
  const count = handProtectionFamilies.reduce((total, family) => total + (groups.get(family.slug) || []).length, 0);
  const canonical = categoryUrl('hand-protection');
  const description = 'Shop safety gloves in Dubai by type: nitrile-coated, cut-resistant, latex, leather, welding, cotton, impact, chemical and disposable hand protection.';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><base href="/"><title>Safety Gloves by Type Dubai | Xpertone Creative</title><meta name="description" content="${description}"><link rel="canonical" href="${canonical}"><meta property="og:type" content="website"><meta property="og:title" content="Safety Gloves by Type Dubai"><meta property="og:description" content="${description}"><meta property="og:url" content="${canonical}"><meta property="og:image" content="${origin}/assets/img/brand/og-xpertone.png"><link rel="icon" type="image/png" sizes="32x32" href="assets/img/brand/favicon-32.png"><link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css"><link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css"><link rel="stylesheet" href="assets/css/main.css?v=20260914sku"></head><body data-page="shop"><a class="skip-link" href="#main">Skip to content</a><div id="siteHeader"></div><main id="main"><section class="section section--alt"><div class="container"><nav aria-label="Breadcrumb"><a href="/">Home</a> / <a href="/shop.html">Shop</a> / <span>Hand Protection</span></nav><h1 class="mt-3">Hand Protection</h1><p class="lead">Choose gloves by construction and intended use. Each product stays available under one clear glove type with its SKU, sizes and live stock information.</p><p>${count} published products are organized into ${handProtectionFamilies.length} glove types.</p></div></section><section class="section"><div class="container"><h2>Shop Safety Gloves by Type</h2><div class="row g-4">${cards}</div></div></section><section class="section section--alt"><div class="container"><h2>Hand protection supplier in Dubai and the UAE</h2><p>Compare nitrile, latex, cut-resistant, leather, welding, cotton, impact, chemical and disposable glove options. Always match the verified product specification to the workplace hazard and task.</p></div></section></main><div id="siteFooter"></div><script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script><script src="assets/js/config.js?v=20260914sku"></script><script src="assets/js/store.js?v=20260914sku"></script><script src="assets/js/ui.js?v=20260914sku"></script></body></html>`;
}

function safetyShoeFamilyPage(family, items) {
  const canonical = `${categoryUrl('safety-shoes')}${family.slug}/`;
  const description = `Shop ${family.name.toLowerCase()} in Dubai and across the UAE. Compare ${items.length} models with SKU, available sizes, stock and current pricing.`;
  const itemList = { '@context': 'https://schema.org', '@type': 'ItemList', name: family.name,
    itemListElement: items.map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: productUrl(p), name: p.title })) };
  const breadcrumb = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: `${origin}/` },
    { '@type': 'ListItem', position: 2, name: 'Safety Shoes', item: categoryUrl('safety-shoes') },
    { '@type': 'ListItem', position: 3, name: family.name, item: canonical }
  ]};
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><base href="/"><title>${esc(family.name)} Dubai & UAE | Xpertone Creative</title><meta name="description" content="${esc(description)}"><link rel="canonical" href="${canonical}"><meta property="og:type" content="website"><meta property="og:title" content="${esc(family.name)} Dubai & UAE"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${canonical}"><meta property="og:image" content="${origin}/assets/img/brand/og-xpertone.png"><link rel="icon" type="image/png" sizes="32x32" href="assets/img/brand/favicon-32.png"><link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css"><link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css"><link rel="stylesheet" href="assets/css/main.css?v=20260914sku"><script type="application/ld+json">${JSON.stringify(itemList)}</script><script type="application/ld+json">${JSON.stringify(breadcrumb)}</script></head><body data-page="shop"><a class="skip-link" href="#main">Skip to content</a><div id="siteHeader"></div><main id="main"><section class="section section--alt"><div class="container"><nav aria-label="Breadcrumb"><a href="/">Home</a> / <a href="/category/safety-shoes/">Safety Shoes</a> / <span>${esc(family.name)}</span></nav><h1 class="mt-3">${esc(family.name)} in Dubai</h1><p class="lead">${esc(family.description)}</p><p>${items.length} products currently available. Unit of sale: pair.</p></div></section><section class="section"><div class="container"><div class="row g-4">${items.map(productCard).join('')}</div></div></section><section class="section section--alt"><div class="container"><h2>Choosing ${esc(family.name)}</h2><p>Compare the stated ankle style, toe and midsole construction, outsole properties and verified safety standard on each product page. Match the final footwear to your workplace risk assessment.</p></div></section></main><div id="siteFooter"></div><script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script><script src="assets/js/config.js?v=20260914sku"></script><script src="assets/js/store.js?v=20260914sku"></script><script src="assets/js/ui.js?v=20260914sku"></script></body></html>`;
}

function safetyShoeHub(groups) {
  const cards = safetyShoeFamilies.map(family => {
    const items = groups.get(family.slug) || [];
    const image = familyThumbnailAsset('safety-shoes', family, items) || items[0]?.images?.[0];
    return `<div class="col-md-6 col-xl-4"><article class="workwear-family-card">${image ? `<img src="${esc(image)}" alt="${esc(family.name)}" loading="lazy" width="600" height="420">` : ''}<div><p class="workwear-family-card__eyebrow">${items.length} products</p><h2><a href="/category/safety-shoes/${family.slug}/">${esc(family.name)}</a></h2><p>${esc(family.description)}</p><a class="btn btn-xo btn-sm-xo" href="/category/safety-shoes/${family.slug}/">View products</a></div></article></div>`;
  }).join('');
  const count = safetyShoeFamilies.reduce((total, family) => total + (groups.get(family.slug) || []).length, 0);
  const canonical = categoryUrl('safety-shoes');
  const description = 'Shop safety footwear in Dubai by type: low-ankle shoes, high-ankle boots, executive and slip-on shoes, rigger boots, gumboots and anti-slip clogs.';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><base href="/"><title>Safety Shoes by Type Dubai | Xpertone Creative</title><meta name="description" content="${description}"><link rel="canonical" href="${canonical}"><meta property="og:type" content="website"><meta property="og:title" content="Safety Shoes by Type Dubai"><meta property="og:description" content="${description}"><meta property="og:url" content="${canonical}"><meta property="og:image" content="${origin}/assets/img/brand/og-xpertone.png"><link rel="icon" type="image/png" sizes="32x32" href="assets/img/brand/favicon-32.png"><link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css"><link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css"><link rel="stylesheet" href="assets/css/main.css?v=20260914sku"></head><body data-page="shop"><a class="skip-link" href="#main">Skip to content</a><div id="siteHeader"></div><main id="main"><section class="section section--alt"><div class="container"><nav aria-label="Breadcrumb"><a href="/">Home</a> / <a href="/shop.html">Shop</a> / <span>Safety Shoes</span></nav><h1 class="mt-3">Safety Shoes</h1><p class="lead">Choose safety footwear by ankle height, closure and intended workplace use. Each model stays in one clear category with its SKU, sizes, unit and stock information.</p><p>${count} published products are organized into ${safetyShoeFamilies.length} footwear types.</p></div></section><section class="section"><div class="container"><h2>Shop Safety Shoes by Type</h2><div class="row g-4">${cards}</div></div></section><section class="section section--alt"><div class="container"><h2>Safety footwear supplier in Dubai and the UAE</h2><p>Compare low-ankle shoes, high-ankle boots, executive and slip-on styles, rigger boots, gumboots and anti-slip clogs. Check the verified specification on each product before ordering.</p></div></section></main><div id="siteFooter"></div><script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script><script src="assets/js/config.js?v=20260914sku"></script><script src="assets/js/store.js?v=20260914sku"></script><script src="assets/js/ui.js?v=20260914sku"></script></body></html>`;
}

function headProtectionFamilyPage(family, items) {
  const canonical = `${categoryUrl('helmets')}${family.slug}/`;
  const description = `Shop ${family.name.toLowerCase()} in Dubai and across the UAE. Compare ${items.length} products with SKU, stock, unit and current pricing.`;
  const itemList = { '@context': 'https://schema.org', '@type': 'ItemList', name: family.name,
    itemListElement: items.map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: productUrl(p), name: p.title })) };
  const breadcrumb = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: `${origin}/` },
    { '@type': 'ListItem', position: 2, name: 'Head Protection', item: categoryUrl('helmets') },
    { '@type': 'ListItem', position: 3, name: family.name, item: canonical }
  ]};
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><base href="/"><title>${esc(family.name)} Dubai & UAE | Xpertone Creative</title><meta name="description" content="${esc(description)}"><link rel="canonical" href="${canonical}"><meta property="og:type" content="website"><meta property="og:title" content="${esc(family.name)} Dubai & UAE"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${canonical}"><meta property="og:image" content="${origin}/assets/img/brand/og-xpertone.png"><link rel="icon" type="image/png" sizes="32x32" href="assets/img/brand/favicon-32.png"><link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css"><link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css"><link rel="stylesheet" href="assets/css/main.css?v=20260914sku"><script type="application/ld+json">${JSON.stringify(itemList)}</script><script type="application/ld+json">${JSON.stringify(breadcrumb)}</script></head><body data-page="shop"><a class="skip-link" href="#main">Skip to content</a><div id="siteHeader"></div><main id="main"><section class="section section--alt"><div class="container"><nav aria-label="Breadcrumb"><a href="/">Home</a> / <a href="/category/helmets/">Head Protection</a> / <span>${esc(family.name)}</span></nav><h1 class="mt-3">${esc(family.name)} in Dubai</h1><p class="lead">${esc(family.description)}</p><p>${items.length} products currently available. Unit of sale: piece.</p></div></section><section class="section"><div class="container"><div class="row g-4">${items.map(productCard).join('')}</div></div></section><section class="section section--alt"><div class="container"><h2>Choosing ${esc(family.name)}</h2><p>Match the verified standard, construction, suspension and accessory compatibility to your workplace risk assessment. Follow the manufacturer’s inspection and replacement guidance.</p></div></section></main><div id="siteFooter"></div><script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script><script src="assets/js/config.js?v=20260914sku"></script><script src="assets/js/store.js?v=20260914sku"></script><script src="assets/js/ui.js?v=20260914sku"></script></body></html>`;
}

function headProtectionHub(groups) {
  const cards = headProtectionFamilies.map(family => {
    const items = groups.get(family.slug) || [];
    const image = familyThumbnailAsset('helmets', family, items) || items[0]?.images?.[0];
    return `<div class="col-md-6 col-xl-4"><article class="workwear-family-card">${image ? `<img src="${esc(image)}" alt="${esc(family.name)}" loading="lazy" width="600" height="420">` : ''}<div><p class="workwear-family-card__eyebrow">${items.length} products</p><h2><a href="/category/helmets/${family.slug}/">${esc(family.name)}</a></h2><p>${esc(family.description)}</p><a class="btn btn-xo btn-sm-xo" href="/category/helmets/${family.slug}/">View products</a></div></article></div>`;
  }).join('');
  const count = headProtectionFamilies.reduce((total, family) => total + (groups.get(family.slug) || []).length, 0);
  const canonical = categoryUrl('helmets');
  const description = 'Shop head protection in Dubai by type: industrial safety helmets, bump caps, face shields, welding helmets, full-brim headwear and helmet accessories.';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><base href="/"><title>Head Protection by Type Dubai | Xpertone Creative</title><meta name="description" content="${description}"><link rel="canonical" href="${canonical}"><meta property="og:type" content="website"><meta property="og:title" content="Head Protection by Type Dubai"><meta property="og:description" content="${description}"><meta property="og:url" content="${canonical}"><meta property="og:image" content="${origin}/assets/img/brand/og-xpertone.png"><link rel="icon" type="image/png" sizes="32x32" href="assets/img/brand/favicon-32.png"><link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css"><link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css"><link rel="stylesheet" href="assets/css/main.css?v=20260914sku"></head><body data-page="shop"><a class="skip-link" href="#main">Skip to content</a><div id="siteHeader"></div><main id="main"><section class="section section--alt"><div class="container"><nav aria-label="Breadcrumb"><a href="/">Home</a> / <a href="/shop.html">Shop</a> / <span>Head Protection</span></nav><h1 class="mt-3">Head Protection</h1><p class="lead">Choose head and face protection by product type and intended use. Every item remains clearly identified by SKU with its live stock, unit and pricing information.</p><p>${count} published products are organized into ${headProtectionFamilies.length} protection types.</p></div></section><section class="section"><div class="container"><h2>Shop Head Protection by Type</h2><div class="row g-4">${cards}</div></div></section><section class="section section--alt"><div class="container"><h2>Head protection supplier in Dubai and the UAE</h2><p>Compare industrial helmets, bump caps, face shields, welding helmets and compatible accessories. Review the verified specification on each product before ordering.</p></div></section></main><div id="siteFooter"></div><script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script><script src="assets/js/config.js?v=20260914sku"></script><script src="assets/js/store.js?v=20260914sku"></script><script src="assets/js/ui.js?v=20260914sku"></script></body></html>`;
}

function ppeFamilyPage(categorySlug, categoryName, family, items, guidance) {
  const canonical = `${categoryUrl(categorySlug)}${family.slug}/`;
  const description = `Shop ${family.name.toLowerCase()} in Dubai and across the UAE. Compare ${items.length} products with SKU, stock, unit and current pricing.`;
  const itemList = { '@context': 'https://schema.org', '@type': 'ItemList', name: family.name,
    itemListElement: items.map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: productUrl(p), name: p.title })) };
  const breadcrumb = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: `${origin}/` },
    { '@type': 'ListItem', position: 2, name: categoryName, item: categoryUrl(categorySlug) },
    { '@type': 'ListItem', position: 3, name: family.name, item: canonical }
  ]};
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><base href="/"><title>${esc(family.name)} Dubai & UAE | Xpertone Creative</title><meta name="description" content="${esc(description)}"><link rel="canonical" href="${canonical}"><meta property="og:type" content="website"><meta property="og:title" content="${esc(family.name)} Dubai & UAE"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${canonical}"><meta property="og:image" content="${origin}/assets/img/brand/og-xpertone.png"><link rel="icon" type="image/png" sizes="32x32" href="assets/img/brand/favicon-32.png"><link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css"><link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css"><link rel="stylesheet" href="assets/css/main.css?v=20260914sku"><script type="application/ld+json">${JSON.stringify(itemList)}</script><script type="application/ld+json">${JSON.stringify(breadcrumb)}</script></head><body data-page="shop"><a class="skip-link" href="#main">Skip to content</a><div id="siteHeader"></div><main id="main"><section class="section section--alt"><div class="container"><nav aria-label="Breadcrumb"><a href="/">Home</a> / <a href="/category/${categorySlug}/">${esc(categoryName)}</a> / <span>${esc(family.name)}</span></nav><h1 class="mt-3">${esc(family.name)} in Dubai</h1><p class="lead">${esc(family.description)}</p><p>${items.length} products currently available. See each product page for its exact unit of sale.</p></div></section><section class="section"><div class="container"><div class="row g-4">${items.map(productCard).join('')}</div></div></section><section class="section section--alt"><div class="container"><h2>Choosing ${esc(family.name)}</h2><p>${esc(guidance)}</p></div></section></main><div id="siteFooter"></div><script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script><script src="assets/js/config.js?v=20260914sku"></script><script src="assets/js/store.js?v=20260914sku"></script><script src="assets/js/ui.js?v=20260914sku"></script></body></html>`;
}

function ppeFamilyHub(categorySlug, categoryName, families, groups, description, guide) {
  const cards = families.map(family => {
    const items = groups.get(family.slug) || [];
    const image = familyThumbnailAsset(categorySlug, family, items) || family.thumbnail || items[0]?.images?.[0];
    return `<div class="col-md-6 col-xl-4"><article class="workwear-family-card">${image ? `<img src="${esc(image)}" alt="${esc(family.name)}" loading="lazy" width="600" height="420">` : ''}<div><p class="workwear-family-card__eyebrow">${items.length} products</p><h2><a href="/category/${categorySlug}/${family.slug}/">${esc(family.name)}</a></h2><p>${esc(family.description)}</p><a class="btn btn-xo btn-sm-xo" href="/category/${categorySlug}/${family.slug}/">View products</a></div></article></div>`;
  }).join('');
  const count = families.reduce((total, family) => total + (groups.get(family.slug) || []).length, 0);
  const canonical = categoryUrl(categorySlug);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><base href="/"><title>${esc(categoryName)} by Type Dubai | Xpertone Creative</title><meta name="description" content="${esc(description)}"><link rel="canonical" href="${canonical}"><meta property="og:type" content="website"><meta property="og:title" content="${esc(categoryName)} by Type Dubai"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${canonical}"><meta property="og:image" content="${origin}/assets/img/brand/og-xpertone.png"><link rel="icon" type="image/png" sizes="32x32" href="assets/img/brand/favicon-32.png"><link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css"><link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css"><link rel="stylesheet" href="assets/css/main.css?v=20260914sku"></head><body data-page="shop"><a class="skip-link" href="#main">Skip to content</a><div id="siteHeader"></div><main id="main"><section class="section section--alt"><div class="container"><nav aria-label="Breadcrumb"><a href="/">Home</a> / <a href="/shop.html">Shop</a> / <span>${esc(categoryName)}</span></nav><h1 class="mt-3">${esc(categoryName)}</h1><p class="lead">${esc(description)}</p><p>${count} published products are organized into ${families.length} practical product types.</p></div></section><section class="section"><div class="container"><h2>Shop ${esc(categoryName)} by Type</h2><div class="row g-4">${cards}</div></div></section><section class="section section--alt"><div class="container"><h2>${esc(categoryName)} supplier in Dubai and the UAE</h2><p>${esc(guide)}</p></div></section></main><div id="siteFooter"></div><script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script><script src="assets/js/config.js?v=20260914sku"></script><script src="assets/js/store.js?v=20260914sku"></script><script src="assets/js/ui.js?v=20260914sku"></script></body></html>`;
}

function categoryPage(slug, items, page) {
  const name = items[0].categoryName;
  const copy = categoryCopy[slug] || defaultCategoryCopy(name, items.length);
  const pages = Math.ceil(items.length / PAGE_SIZE);
  const shown = items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const canonical = page === 1 ? categoryUrl(slug) : `${categoryUrl(slug)}page/${page}/`;
  const title = `${copy.title}${page > 1 ? ` - Page ${page}` : ''} | Xpertone Creative LLC-FZ`;
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
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><base href="/"><title>${esc(title)}</title><meta name="description" content="${esc(copy.description)}"><link rel="canonical" href="${canonical}">${page > 1 ? '<meta name="robots" content="noindex,follow">' : ''}<meta property="og:type" content="website"><meta property="og:title" content="${esc(copy.title)}"><meta property="og:description" content="${esc(copy.description)}"><meta property="og:url" content="${canonical}"><meta property="og:image" content="${origin}/assets/img/brand/og-xpertone.png"><link rel="icon" type="image/png" sizes="32x32" href="assets/img/brand/favicon-32.png"><link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css"><link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css"><link rel="stylesheet" href="assets/css/main.css?v=20260914sku"><script type="application/ld+json">${JSON.stringify(itemList)}</script><script type="application/ld+json">${JSON.stringify(breadcrumb)}</script></head><body data-page="shop"><a class="skip-link" href="#main">Skip to content</a><div id="siteHeader"></div><main id="main"><section class="section section--alt"><div class="container"><nav aria-label="Breadcrumb"><a href="/">Home</a> / <a href="/shop.html">Shop</a> / <span>${esc(name)}</span></nav><h1 class="mt-3">${esc(copy.title)}</h1><p class="lead">${esc(copy.intro)}</p><p>${items.length} products available in this range.</p></div></section><section class="section"><div class="container"><div class="row g-4">${shown.map(productCard).join('')}</div>${pagination}</div></section>${faq}</main><div id="siteFooter"></div><script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script><script src="assets/js/config.js?v=20260914sku"></script><script src="assets/js/store.js?v=20260914sku"></script><script src="assets/js/ui.js?v=20260914sku"></script></body></html>`;
}

fs.rmSync(path.join(root, 'products'), { recursive: true, force: true });
fs.rmSync(path.join(root, 'category'), { recursive: true, force: true });
for (const p of list) generateProduct(p);
for (const [slug, items] of groups) {
  if (slug === 'uniforms' || slug === 'safety-vests' || slug === 'hand-protection' || slug === 'safety-shoes' || slug === 'helmets' || slug === 'eye-face-protection' || slug === 'hearing-respiratory' || slug === 'traffic-safety' || slug === 'hardware-tools') continue;
  const pages = Math.ceil(items.length / PAGE_SIZE);
  for (let page = 1; page <= pages; page++) {
    const target = page === 1 ? path.join(root, 'category', slug, 'index.html') : path.join(root, 'category', slug, 'page', String(page), 'index.html');
    write(target, categoryPage(slug, items, page));
  }
}

const uniformItems = groups.get('uniforms') || [];
const workwearGroups = new Map(workwearFamilies.map(f => [f.slug, []]));
const otherWorkwear = [];
for (const p of uniformItems) {
  const family = workwearFamily(p);
  (family ? workwearGroups.get(family.slug) : otherWorkwear).push(p);
}
write(path.join(root, 'category', 'uniforms', 'index.html'), workwearHub(workwearGroups, otherWorkwear));
for (const family of workwearFamilies) {
  const items = workwearGroups.get(family.slug);
  write(path.join(root, 'category', 'uniforms', family.slug, 'index.html'), workwearFamilyPage(family, items));
}

const safetyVestItems = groups.get('safety-vests') || [];
const safetyVestGroups = new Map(safetyVestFamilies.map(f => [f.slug, []]));
for (const product of safetyVestItems) safetyVestGroups.get(safetyVestFamily(product).slug).push(product);
write(path.join(root, 'category', 'safety-vests', 'index.html'), safetyVestHub(safetyVestGroups));
for (const family of safetyVestFamilies) {
  write(path.join(root, 'category', 'safety-vests', family.slug, 'index.html'), safetyVestFamilyPage(family, safetyVestGroups.get(family.slug)));
}

const handProtectionItems = groups.get('hand-protection') || [];
const handProtectionGroups = new Map(handProtectionFamilies.map(family => [family.slug, []]));
for (const product of handProtectionItems) {
  const family = handProtectionFamily(product);
  if (family) handProtectionGroups.get(family.slug).push(product);
}
write(path.join(root, 'category', 'hand-protection', 'index.html'), handProtectionHub(handProtectionGroups));
for (const family of handProtectionFamilies) {
  write(path.join(root, 'category', 'hand-protection', family.slug, 'index.html'), handProtectionFamilyPage(family, handProtectionGroups.get(family.slug)));
}

const safetyShoeItems = groups.get('safety-shoes') || [];
const safetyShoeGroups = new Map(safetyShoeFamilies.map(family => [family.slug, []]));
for (const product of safetyShoeItems) {
  const family = safetyShoeFamily(product);
  if (family) safetyShoeGroups.get(family.slug).push(product);
}
write(path.join(root, 'category', 'safety-shoes', 'index.html'), safetyShoeHub(safetyShoeGroups));
for (const family of safetyShoeFamilies) {
  write(path.join(root, 'category', 'safety-shoes', family.slug, 'index.html'), safetyShoeFamilyPage(family, safetyShoeGroups.get(family.slug)));
}

const headProtectionItems = groups.get('helmets') || [];
const headProtectionGroups = new Map(headProtectionFamilies.map(family => [family.slug, []]));
for (const product of headProtectionItems) {
  const family = headProtectionFamily(product);
  if (family) headProtectionGroups.get(family.slug).push(product);
}
write(path.join(root, 'category', 'helmets', 'index.html'), headProtectionHub(headProtectionGroups));
for (const family of headProtectionFamilies) {
  write(path.join(root, 'category', 'helmets', family.slug, 'index.html'), headProtectionFamilyPage(family, headProtectionGroups.get(family.slug)));
}

const eyeFaceItems = groups.get('eye-face-protection') || [];
const eyeFaceGroups = new Map(eyeFaceFamilies.map(family => [family.slug, []]));
for (const product of eyeFaceItems) {
  const family = eyeFaceFamily(product);
  if (family) eyeFaceGroups.get(family.slug).push(product);
}
write(path.join(root, 'category', 'eye-face-protection', 'index.html'), ppeFamilyHub('eye-face-protection', 'Eye & Face Protection', eyeFaceFamilies, eyeFaceGroups,
  'Shop eye and face protection in Dubai by type, including safety spectacles, anti-fog eyewear, safety goggles, specialty lenses and accessories.',
  'Compare lens treatment, impact protection, coverage and compatibility. Use the verified product specification and workplace risk assessment when selecting protective eyewear.'));
for (const family of eyeFaceFamilies) {
  write(path.join(root, 'category', 'eye-face-protection', family.slug, 'index.html'), ppeFamilyPage('eye-face-protection', 'Eye & Face Protection', family, eyeFaceGroups.get(family.slug), 'Match the verified lens treatment, coverage, impact rating and compatibility to the workplace hazard and task.'));
}

const hearingRespiratoryItems = groups.get('hearing-respiratory') || [];
const hearingRespiratoryGroups = new Map(hearingRespiratoryFamilies.map(family => [family.slug, []]));
for (const product of hearingRespiratoryItems) {
  const family = hearingRespiratoryFamily(product);
  if (family) hearingRespiratoryGroups.get(family.slug).push(product);
}
write(path.join(root, 'category', 'hearing-respiratory', 'index.html'), ppeFamilyHub('hearing-respiratory', 'Hearing & Respiratory Protection', hearingRespiratoryFamilies, hearingRespiratoryGroups,
  'Shop hearing and respiratory protection in Dubai by type, including disposable respirators, reusable masks, filters, earplugs and earmuffs.',
  'Compare the verified filtration or attenuation rating, fit, compatibility and unit of sale. Select protection according to the workplace exposure assessment.'));
for (const family of hearingRespiratoryFamilies) {
  write(path.join(root, 'category', 'hearing-respiratory', family.slug, 'index.html'), ppeFamilyPage('hearing-respiratory', 'Hearing & Respiratory Protection', family, hearingRespiratoryGroups.get(family.slug), 'Match the verified protection rating, fit, compatibility and replacement schedule to the workplace exposure assessment.'));
}

const trafficSafetyItems = groups.get('traffic-safety') || [];
const trafficSafetyGroups = new Map(trafficSafetyFamilies.map(family => [family.slug, []]));
for (const product of trafficSafetyItems) {
  const family = trafficSafetyFamily(product);
  if (family) trafficSafetyGroups.get(family.slug).push(product);
}
write(path.join(root, 'category', 'traffic-safety', 'index.html'), ppeFamilyHub('traffic-safety', 'Traffic & Road Safety', trafficSafetyFamilies, trafficSafetyGroups,
  'Shop traffic and road-safety products in Dubai by type, including cones, posts, warning lights, traffic batons, barrier mesh and temporary safety fencing.',
  'Choose road-safety equipment for the traffic plan, visibility conditions, installation environment and verified product specification. Confirm site and authority requirements before deployment.'));
for (const family of trafficSafetyFamilies) {
  write(path.join(root, 'category', 'traffic-safety', family.slug, 'index.html'), ppeFamilyPage('traffic-safety', 'Traffic & Road Safety', family, trafficSafetyGroups.get(family.slug), 'Match the product dimensions, visibility features, power source and installation method to the approved traffic-management plan.'));
}

const hardwareToolItems = groups.get('hardware-tools') || [];
const hardwareToolGroups = new Map(hardwareToolFamilies.map(family => [family.slug, []]));
for (const product of hardwareToolItems) {
  const family = hardwareToolFamily(product);
  if (family) hardwareToolGroups.get(family.slug).push(product);
}
write(path.join(root, 'category', 'hardware-tools', 'index.html'), ppeFamilyHub('hardware-tools', 'Hardware & Tools', hardwareToolFamilies, hardwareToolGroups,
  'Shop hardware, tools and site supplies in Dubai by type, including hammers, cutting blades, fire blankets, warning tapes, scaffolding tags and lifting equipment.',
  'Select tools and site supplies by the intended task, compatible equipment, load or size requirement and verified product specification. Follow workplace procedures and manufacturer guidance.'));
for (const family of hardwareToolFamilies) {
  write(path.join(root, 'category', 'hardware-tools', family.slug, 'index.html'), ppeFamilyPage('hardware-tools', 'Hardware & Tools', family, hardwareToolGroups.get(family.slug), 'Confirm the required size, capacity, compatibility and verified specification before ordering for workplace use.'));
}

const staticUrls = [
  [`${origin}/`, 'weekly', '1.0'], [`${origin}/shop.html`, 'daily', '0.8'],
  [`${origin}/about.html`, 'monthly', '0.6'], [`${origin}/contact.html`, 'monthly', '0.7'],
  [`${origin}/sitemap.html`, 'weekly', '0.5'],
  [`${origin}/blog/embroidery-vs-dtf-printing-company-uniforms-dubai/`, 'monthly', '0.8'],
  [`${origin}/blog/construction-uniform-supplier-dubai/`, 'monthly', '0.8'],
  [`${origin}/blog/work-uniform-supplier-dubai-guide/`, 'monthly', '0.8'],
  [`${origin}/blog/coverall-fabric-gsm-uae-guide/`, 'monthly', '0.8']
];
const xml = rows => `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${rows.map(([url, freq, priority]) => `  <url><loc>${esc(url)}</loc><lastmod>${today}</lastmod><changefreq>${freq}</changefreq><priority>${priority}</priority></url>`).join('\n')}\n</urlset>\n`;
write(path.join(root, 'sitemap-pages.xml'), xml(staticUrls));
const categoryRows = [...groups.keys()].map(slug => [categoryUrl(slug), 'weekly', '0.8']);
for (const family of workwearFamilies) if (workwearGroups.get(family.slug).length) categoryRows.push([workwearUrl(family.slug), 'weekly', '0.8']);
for (const family of safetyVestFamilies) categoryRows.push([`${categoryUrl('safety-vests')}${family.slug}/`, 'weekly', '0.8']);
for (const family of handProtectionFamilies) categoryRows.push([`${categoryUrl('hand-protection')}${family.slug}/`, 'weekly', '0.8']);
for (const family of safetyShoeFamilies) categoryRows.push([`${categoryUrl('safety-shoes')}${family.slug}/`, 'weekly', '0.8']);
for (const family of headProtectionFamilies) categoryRows.push([`${categoryUrl('helmets')}${family.slug}/`, 'weekly', '0.8']);
for (const family of eyeFaceFamilies) categoryRows.push([`${categoryUrl('eye-face-protection')}${family.slug}/`, 'weekly', '0.8']);
for (const family of hearingRespiratoryFamilies) categoryRows.push([`${categoryUrl('hearing-respiratory')}${family.slug}/`, 'weekly', '0.8']);
for (const family of trafficSafetyFamilies) categoryRows.push([`${categoryUrl('traffic-safety')}${family.slug}/`, 'weekly', '0.8']);
for (const family of hardwareToolFamilies) categoryRows.push([`${categoryUrl('hardware-tools')}${family.slug}/`, 'weekly', '0.8']);
const htmlSitemapCategories = categoryRows.map(([url]) => `<li><a href="${esc(url)}">${esc(url.replace(`${origin}/category/`, '').replace(/\/$/, '').replaceAll('-', ' '))}</a></li>`).join('');
const htmlSitemapProducts = list.map(p => `<li><a href="${esc(productUrl(p))}">${esc(p.title)}${p.sku ? ` — SKU ${esc(p.sku)}` : ''}</a></li>`).join('');
write(path.join(root, 'sitemap.html'), `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Product Catalogue Index | Xpertone Dubai</title><meta name="description" content="Browse every published Xpertone Creative product and safety category by SKU, with direct links to workwear, PPE, footwear and industrial supplies in Dubai."><link rel="canonical" href="${origin}/sitemap.html"><link rel="stylesheet" href="assets/css/main.css?v=20260914sku"></head><body><main id="main" class="container py-5"><nav aria-label="Breadcrumb"><a href="/">Home</a> / Catalogue index</nav><h1>Product Catalogue Index</h1><p>Browse every published product category and SKU supplied by Xpertone Creative in Dubai and across the UAE.</p><h2>Categories</h2><ul>${htmlSitemapCategories}</ul><h2>Products</h2><ul>${htmlSitemapProducts}</ul></main></body></html>`);
write(path.join(root, 'sitemap-categories.xml'), xml(categoryRows));
write(path.join(root, 'sitemap-products.xml'), xml(list.map(p => [productUrl(p), 'weekly', '0.6'])));
write(path.join(root, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <sitemap><loc>${origin}/sitemap-pages.xml</loc><lastmod>${today}</lastmod></sitemap>\n  <sitemap><loc>${origin}/sitemap-categories.xml</loc><lastmod>${today}</lastmod></sitemap>\n  <sitemap><loc>${origin}/sitemap-products.xml</loc><lastmod>${today}</lastmod></sitemap>\n</sitemapindex>\n`);

const redirect = (to, title) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex,follow"><link rel="canonical" href="${to}"><meta http-equiv="refresh" content="0;url=${to}"><title>${esc(title)}</title></head><body><p>This page moved to <a href="${to}">${esc(title)}</a>.</p></body></html>`;
write(path.join(root, 'category', 'shoes', 'index.html'), redirect(`${origin}/category/safety-shoes/`, 'Safety Shoes'));

console.log(JSON.stringify({ products: list.length, categories: groups.size, categoryPages: [...groups.values()].reduce((n, x) => n + Math.ceil(x.length / PAGE_SIZE), 0) }));
