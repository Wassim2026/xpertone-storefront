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
  DATA_SOURCE: 'auto',

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
       so these work on every product without hand-tuned coordinates. */
    spots: {
      'Left chest':             [{ view: 0, rx: 0.34, ry: 0.30, rw: 0.26, rh: 0.16, label: 'Chest' }],
      'Full back':              [{ view: 1, rx: 0.50, ry: 0.40, rw: 0.58, rh: 0.38, label: 'Back' }],
      'Front centre':           [{ view: 0, rx: 0.50, ry: 0.45, rw: 0.52, rh: 0.34, label: 'Front' }],
      'Left chest + full back': [{ view: 0, rx: 0.34, ry: 0.30, rw: 0.26, rh: 0.16, label: 'Chest' },
                                 { view: 1, rx: 0.50, ry: 0.40, rw: 0.58, rh: 0.38, label: 'Back' }],
      'Both sleeves':           [{ view: 0, rx: 0.12, ry: 0.32, rw: 0.18, rh: 0.14, label: 'Sleeve' },
                                 { view: 1, rx: 0.88, ry: 0.32, rw: 0.18, rh: 0.14, label: 'Sleeve' }],
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
     COMPANY
     --------------------------------------------------------------------- */
  COMPANY: {
    name: 'XpertOne Prints',
    legalName: 'XpertOne Creative',
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
     --------------------------------------------------------------------- */
  CATEGORIES: [
    {
      slug: 'safety-vests',
      name: 'Safety Vests',
      blurb: 'Hi-vis reflective vests - general, supervisor and engineer grade.',
      apiKeys: ['Safety Vest'],
      source: 'products'
    },
    {
      slug: 'uniforms',
      name: 'Pant & Shirt Sets',
      blurb: 'Cotton and twill workwear sets, plain or reflective, 190-260 GSM.',
      apiKeys: ['Pant-Shirts-Coveralls'],
      source: 'products'
    },
    {
      slug: 'cargo-trousers',
      name: 'Cargo Trousers',
      blurb: 'ProGuard cargo pants in polyester-cotton and 100% cotton canvas.',
      apiKeys: ['Cargo Trousers'],
      source: 'products'
    },
    {
      slug: 'helmets',
      name: 'Safety Helmets',
      blurb: 'Industrial hard hats with adjustable harness, six colourways.',
      apiKeys: ['Helmet', 'helmet'],
      source: 'helmets'
    }
  ],

  /* Sizes are normalised to this order wherever they appear. */
  SIZE_ORDER: ['S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL'],

  /* localStorage key for the cart. Bump the suffix to invalidate old carts. */
  CART_KEY: 'xo_cart_v1'
};
