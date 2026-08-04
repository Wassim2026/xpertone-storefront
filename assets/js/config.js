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
    /* Used only when the customer attaches artwork - a normal multipart POST,
       because background requests cannot carry file attachments. */
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
     ARTWORK UPLOAD
     ---------------------------------------------------------------------
     Customers attach their logo at checkout and on the quote form. When a
     file is attached the form is posted as multipart so the file arrives as
     a real email attachment; with no file it goes as a background request
     and the customer never leaves the page.

     maxFileMB is enforced in the browser. Oversized files are refused with a
     clear message rather than failing silently.
     --------------------------------------------------------------------- */
  PRINTING: {
    maxFileMB: 10,
    accept: '.pdf,.ai,.eps,.svg,.png,.jpg,.jpeg,.webp,.zip',
    placements: [
      'Left chest',
      'Left chest + full back',
      'Full back only',
      'Front centre',
      'Both sleeves',
      'Left chest + back + sleeve',
      'Not sure - please advise'
    ]
  },

  /* ---------------------------------------------------------------------
     VOLUME PRICE BREAKS
     ---------------------------------------------------------------------
     Applied automatically per product line, based on the total pieces of
     that product across all sizes. The highest tier the quantity reaches
     wins - they are not cumulative.

     On a 12.00 vest:  25 pcs -> 10.80   50 pcs -> 10.20   100 pcs -> 9.60

     min      = quantity from which the discount applies
     discount = fraction off the list price (0.10 = 10%)
     label    = shown on the product page price-break table

     Set the array to [] to switch volume pricing off entirely.
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
     ---------------------------------------------------------------------
     apiKeys maps a storefront category to the raw category values the
     API returns. Add a category here and it appears in the nav, on the
     home page and in the shop filters automatically. --------------------- */
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
