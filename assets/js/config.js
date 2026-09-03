/* =========================================================================
   XpertOne Prints - Runtime configuration
   -------------------------------------------------------------------------
   This is the ONLY file the backend developer needs to touch to point the
   storefront at a different server. Everything else reads from here.
   ========================================================================= */

window.XO_CONFIG = {

  /* ---------------------------------------------------------------------
     DATA SOURCE
     ---------------------------------------------------------------------
     'live'  -> read the catalogue from API_BASE (the existing PHP endpoints)
     'local' -> read the catalogue from data/products.json (bundled snapshot)
     'auto'  -> try live first, fall back to the local snapshot on failure
     --------------------------------------------------------------------- */
  /* ---------------------------------------------------------------------
     WHERE THE CATALOGUE COMES FROM
     ---------------------------------------------------------------------
     'supabase' -> read the live catalogue from the admin panel database.
                   Prices, photos and product details are whatever is in the
                   admin panel right now. CURRENT SETTING.
     'local'    -> read the bundled snapshot in data/products.json
     'live'     -> read the old PHP API at API_BASE
     'auto'     -> try the PHP API, fall back to the bundled snapshot

     If Supabase is ever unreachable the shop automatically falls back to
     data/products.json, so the catalogue never renders empty.
     --------------------------------------------------------------------- */
  DATA_SOURCE: 'supabase',

  /* Admin panel database. The key below is a PUBLISHABLE key: it is meant to
     be readable in the browser. It can only read the public catalogue view —
     supplier cost, your markup and the team list are all blocked by row level
     security. Never put the SECRET key in this file. */
  SUPABASE: {
    url: 'https://myodfvshmusywmhdozwt.supabase.co',
    key: 'sb_publishable_yqVW7IVTIgSarj8nKwVTuQ_zrj80eQ-'
  },

  API_BASE: 'https://api.xpertoneprints.com',

  ENDPOINTS: {
    // GET - existing endpoints, already live today
    products:  '/api/safety_products.php',   // vests, pant & shirt sets, cargo trousers
    helmets:   '/api/helmets.php',           // helmets

    // POST - NOT BUILT YET. See docs/API.md for the exact contract the
    // front-end expects. Until these exist, ORDER_MODE below applies.
    createOrder:   '/api/orders.php',
    createInquiry: '/api/inquiries.php',
    quoteRequest:  '/api/quotes.php'
  },

  /* Where uploaded product images live. Filenames from the API are appended. */
  UPLOADS_BASE: 'https://api.xpertoneprints.com/uploads/',

  /* ---------------------------------------------------------------------
     ORDER SUBMISSION BEHAVIOUR
     ---------------------------------------------------------------------
     'email'    -> checkout emails the full order to EMAIL.to through a
                   form-to-email relay. No mail server needed. CURRENT SETTING.
     'whatsapp' -> checkout builds a formatted order message and hands off to
                   WhatsApp. Works with zero backend.
     'api'      -> checkout POSTs to ENDPOINTS.createOrder. Switch to this the
                   day the backend is ready - no other change required.
     'both'     -> POST to the API, and still offer the WhatsApp handoff.

     In every mode the "Send on WhatsApp instead" button stays available, and
     any failure falls back to WhatsApp so an order is never lost.
     --------------------------------------------------------------------- */
  ORDER_MODE: 'email',

  /* ---------------------------------------------------------------------
     ORDER NOTIFICATION EMAIL
     ---------------------------------------------------------------------
     FormSubmit relays a POST into an email. It is free, needs no account and
     no server, and the address must be confirmed once by clicking the link in
     the first email it sends.

     This is deliberately temporary. When POST /api/orders.php exists, set
     ORDER_MODE to 'api' and the site sends orders to your own server instead,
     with nothing passing through a third party.
     --------------------------------------------------------------------- */
  EMAIL: {
    enabled: true,
    to: 'xpertonecreative@gmail.com',
    endpoint: 'https://formsubmit.co/ajax/xpertonecreative@gmail.com',
    /* Used when the order carries artwork - a normal multipart POST, because
       background requests cannot carry file attachments. */
    uploadEndpoint: 'https://formsubmit.co/xpertonecreative@gmail.com',
    orderSubject: 'New website order',
    inquirySubject: 'New quote request'
  },

  /* ---------------------------------------------------------------------
     COMMERCIAL RULES
     --------------------------------------------------------------------- */
  CURRENCY: 'AED',
  VAT_RATE: 0.05,              // UAE standard rate, 5%
  PRICES_INCLUDE_VAT: false,   // catalogue prices are ex-VAT

  /* ---------------------------------------------------------------------
     INDICATIVE PRICING
     ---------------------------------------------------------------------
     The Remart range was loaded from the supplier catalogue, which carries
     no selling prices. Every product currently holds a category-level
     indicative figure and is marked priceStatus:'indicative' in
     data/products.json.

     While this is true the site says so on every price, and checkout is
     worded as a quote request rather than a firm order, so nobody can buy
     at a wrong price. Put your real numbers in the price field of
     data/products.json and drop priceStatus, and the wording disappears by
     itself, product by product.
     --------------------------------------------------------------------- */
  INDICATIVE: {
    label: 'indicative',
    short: 'Indicative — confirmed on your quote',
    long: 'Prices shown are indicative only, for guidance on budget. Your ' +
          'final price depends on quantity, colours, sizes and printing, and ' +
          'is confirmed in writing on your quotation before anything is made.'
  },

  MOQ: 10,                     // minimum order quantity per product line
  FREE_DELIVERY_THRESHOLD: 1000,   // AED, ex-VAT - Dubai
  DELIVERY_FEE: 30,            // AED, below the threshold

  LOGO_PRINTING: {
    enabled: true,
    // Set to 0 to quote logo printing manually instead of charging inline.
    pricePerUnit: 0,
    note: 'Front and back logo printing available - priced per artwork, confirmed on your quote.'
  },

  /* ---------------------------------------------------------------------
     PRODUCT DESIGNER
     ---------------------------------------------------------------------
     Drives the customiser on the product page: the logo upload, the English
     and Arabic text, where the print sits on the preview, and which ink
     colours are offered.
     --------------------------------------------------------------------- */
  PRINTING: {
    maxFileMB: 10,
    accept: '.pdf,.ai,.eps,.svg,.png,.jpg,.jpeg,.webp,.zip',

    /* How aggressively the logo background is cleared, 0-120. Higher removes
       more of an off-white or shadowed background but risks eating the logo. */
    bgTolerance: 46,

    placements: [
      'Left chest',
      'Full back',
      'Front centre',
      'Left chest + full back',
      'Both sleeves',
      'Not sure - please advise'
    ],

    /* Print positions are described against a VIEW of the garment, not the
       photo. view 0 is the front (or the only view), view 1 the back. rx/ry
       are the centre of the print as a fraction of that view, rw its width
       and rh the height it may fill. The site finds the views in each photo,
       so these work on every product without hand-tuned coordinates.

       rows caps how many lines of text belong in that position. A chest badge
       takes the logo and one line; a sleeve takes the logo alone; the back
       takes everything. Leave rows out for no limit.

       edge: 'left' or 'right' anchors the print just inside the garment's
       real edge at that height instead of using rx, which is what a sleeve
       needs - a vest is much narrower at the shoulder than at the hem. */
    spots: {
      'Left chest':             [{ view: 0, rx: 0.33, ry: 0.29, rw: 0.27, rh: 0.19, rows: 1, label: 'Chest' }],
      'Full back':              [{ view: 1, rx: 0.50, ry: 0.40, rw: 0.58, rh: 0.38, label: 'Back' }],
      'Front centre':           [{ view: 0, rx: 0.50, ry: 0.45, rw: 0.52, rh: 0.34, label: 'Front' }],
      'Left chest + full back': [{ view: 0, rx: 0.33, ry: 0.29, rw: 0.27, rh: 0.19, rows: 1, label: 'Chest' },
                                 { view: 1, rx: 0.50, ry: 0.40, rw: 0.58, rh: 0.38, label: 'Back' }],
      'Both sleeves':           [{ view: 0, edge: 'left',  ry: 0.38, rw: 0.13, rh: 0.10, rows: 0, label: 'Sleeve' },
                                 { view: 1, edge: 'right', ry: 0.38, rw: 0.13, rh: 0.10, rows: 0, label: 'Sleeve' }],
      _default:                 [{ view: 0, rx: 0.50, ry: 0.42, rw: 0.50, rh: 0.32, label: 'Print' }]
    },

    /* How many rows of text a customer can type. */
    maxLines: 3,

    /* Logos arriving from WhatsApp are small. Anything under this many pixels
       on the long edge is flagged, and upscaling targets this size. */
    minLogoPx: 600,
    sharpenAmount: 0.45,

    /* Offered as print colours, and used to draw the text on the preview. */
    inkColours: [
      { name: 'White',  hex: '#FFFFFF' },
      { name: 'Black',  hex: '#111111' },
      { name: 'Navy',   hex: '#12284C' },
      { name: 'Red',    hex: '#C8102E' },
      { name: 'Yellow', hex: '#FFC72C' },
      { name: 'Silver', hex: '#C7CBD1' }
    ]
  },

  /* ---------------------------------------------------------------------
     VOLUME PRICE BREAKS
     ---------------------------------------------------------------------
     Applied automatically per product line, based on the total pieces of
     that product across all sizes. The highest tier the quantity reaches
     wins - they are not cumulative.

     On a 12.00 vest:  25 pcs -> 10.80   50 pcs -> 10.20   100 pcs -> 9.60
     --------------------------------------------------------------------- */
  PRICE_TIERS: [
    { min: 25,  discount: 0.10, label: 'Bundle of 25' },
    { min: 50,  discount: 0.15, label: 'Bundle of 50' },
    { min: 100, discount: 0.20, label: '100 or more' }
  ],

  /* ---------------------------------------------------------------------
     BRAND KIT  (brand-kit.html — internal, for the sales team)
     ---------------------------------------------------------------------
     Not linked from the website and marked noindex. Client records live in
     the salesperson's own browser under clientsKey, and can be exported to
     a JSON file. When the backend adds real accounts, POST that same JSON
     to the server and the tool can read from there instead.
     --------------------------------------------------------------------- */
  BRAND_KIT: {
    enabled: true,
    clientsKey: 'xo_clients_v1',

    /* Applied to every item the tool brands. Sleeves are added on top of
       this only when the salesperson ticks the box, because sleeve printing
       needs the client's agreement. */
    placement: 'Left chest + full back',
    sleevePlacement: 'Both sleeves',

    /* JPEG quality used for the PDF catalogue. The ZIP always gets PNGs. */
    pdfQuality: 0.88
  },

  /* ---------------------------------------------------------------------
     COMPANY
     --------------------------------------------------------------------- */
  COMPANY: {
    name: 'XpertOne Prints',
    legalName: 'Xpertone Creative LLC-FZ',
    phone: '+971 54 583 2318',
    phoneRaw: '971545832318',
    whatsapp: '971545832318',
    email: 'info@xpertonecreative.com',
    address: 'Warehouse No 17M3, Street 15A, Al Quoz 4, Dubai, United Arab Emirates',
    hours: 'Saturday to Thursday, 9:00 - 18:00 (GST)',
    trn: ''   // add your Tax Registration Number to print it on quotes
  },

  /* ---------------------------------------------------------------------
     CATEGORY MODEL
     ---------------------------------------------------------------------
     nav: true puts the range in the top navigation. Everything else is still
     reachable from Shop All and from the category tiles on the home page. */
  CATEGORIES: [
    {
      slug: 'safety-vests', printable: true, name: 'Safety Vests', nav: true,
      blurb: 'Hi-vis reflective vests - general, supervisor, executive and engineer grade.',
      apiKeys: ['High Visibility Safety Vest', 'Safety Vest'], source: 'remart'
    },
    {
      slug: 'uniforms', printable: true, name: 'Workwear & Uniforms', nav: true,
      blurb: 'Pant-and-shirt sets, coveralls, lab coats and cargo trousers.',
      apiKeys: ['Working Wear', 'Uniform with Reflective Strips 2025', 'Cargo Pants'], source: 'remart'
    },
    {
      slug: 'safety-shoes', name: 'Safety Shoes', nav: true,
      blurb: 'Steel toe cap safety footwear - low ankle, high ankle and executive.',
      apiKeys: ['Safety Shoes'], source: 'remart'
    },
    {
      slug: 'helmets', printable: true, name: 'Head Protection',
      blurb: 'Industrial hard hats, helmet straps and disposable head covers.',
      apiKeys: ['Head Protection', 'Helmet', 'helmet'], source: 'remart'
    },
    {
      slug: 'hand-protection', name: 'Hand Protection', nav: true,
      blurb: 'Cut-resistant, leather, coated, welding and insulating gloves.',
      apiKeys: ['Hand Protection'], source: 'remart'
    },
    {
      slug: 'eye-face-protection', name: 'Eye & Face Protection',
      blurb: 'Safety spectacles, goggles, face shields and welding shields.',
      apiKeys: ['Eyes Protection', 'Face Protection'], source: 'remart'
    },
    {
      slug: 'hearing-respiratory', name: 'Hearing & Respiratory',
      blurb: 'Earmuffs, earplugs, dust masks and half-face respirators.',
      apiKeys: ['Hearing Protection', 'Respiratory Protection'], source: 'remart'
    },
    {
      slug: 'rainwear-marine', name: 'Rainwear & Marine',
      blurb: 'PVC and polyester rain suits, life jackets, buoys and floating rope.',
      apiKeys: ['Raincoat', 'Life Jackets', 'Marine Safety Products', 'Beach Umbrella'], source: 'remart'
    },
    {
      slug: 'traffic-safety', name: 'Traffic & Road Safety',
      blurb: 'Cones, posts, barriers, warning signs, beacons and reflective tape.',
      apiKeys: ['Traffic Cone & Traffic Post', 'Traffic Light', 'Traffic Fence', 'Traffic Barrier',
                'Traffic Warning Signs', 'Traffic Reflective Tape', 'Traffic Warning Tapes', 'Convex Mirror'],
      source: 'remart'
    },
    {
      slug: 'hardware-tools', name: 'Hardware & Tools',
      blurb: 'Industrial hand tools, spill kits, trolleys, cutting discs and site consumables.',
      apiKeys: ['Hardware - Tools'], source: 'remart'
    },
  ],

  /* Sizes are normalised to this order wherever they appear. */
  SIZE_ORDER: ['S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL'],

  /* localStorage key for the cart. Bump the suffix to invalidate old carts. */
  CART_KEY: 'xo_cart_v1'
};
