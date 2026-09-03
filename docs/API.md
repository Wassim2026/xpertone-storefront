# Backend contract — Xpertone Creative LLC-FZ storefront

This document is the handover spec. The front-end in this repository is finished and
works today; it reads the catalogue from the existing PHP API and hands orders off to
WhatsApp. To turn it into a real transactional store, a backend developer needs to build
the three POST endpoints described below and flip one setting.

Everything the front-end knows about the server lives in **assets/js/config.js**. No
other file needs editing to point at a different host.

---

## 1. What already exists

Two live GET endpoints are already in production and are consumed as-is:

| Method | Path | Returns |
|---|---|---|
| GET | /api/safety_products.php | 45 rows — safety vests, pant & shirt sets, cargo trousers |
| GET | /api/helmets.php | 6 rows — safety helmets |

Base URL: https://api.xpertoneprints.com
Images: https://api.xpertoneprints.com/uploads/{image}

### Row shape returned today

```json
{
  "id": "119",
  "title": "Elite Series - Engineer Golden Yellow",
  "label": "Premium",
  "price": "25.00",
  "image": "1780675231-LVS-Golden Yellow.png",
  "category": "Safety Vest",
  "sub_title": "",
  "size": "[\"S\",\"M\",\"L\",\"XL\",\"2XL\",\"3XL\",\"4XL\",\"5XL\"]"
}
```

The helmets endpoint returns the same fields plus image_url and created_at, and has
no size column.

### Known data problems to fix at the source

The front-end works around all of these at runtime (see Catalog._normalise in
assets/js/store.js), but they should be corrected in the database:

1. **Size typos** — 3Xl, 2Xl and 3X appear instead of 3XL and 2XL. Four rows affected.
2. **Size ordering** — some rows store S, L, M, XL..., so M renders after L.
3. **HTML entities in text columns** — titles contain &amp; rather than &.
4. **The label column is overloaded** — on vests it holds a full product description; on
   uniforms it holds a short attribute ("Front and Back Logo"). These should be two
   columns: description and badge.
5. **Test rows in production** — safety_shoes.php returns a product called "test",
   safety_gloves.php returns "test22". The storefront filters them out; they should be
   deleted.
6. **Empty categories** — the old navigation linked to Business Cards, Shopping Bags,
   Safety Accessories, New Arrivals and Top Rated. No endpoint exists for any of them.
   They have been removed from the new navigation rather than shown as dead links.
7. **Helmet titles** — four of six read "Pemium Safety Helmet". Corrected in the bundled
   snapshot, still wrong in the live database.
8. **Duplicate product rows** — the 26 uniform rows collapse to 5 distinct products with
   colour variants. Consider a product / variant split so the shop page stops showing
   twelve near-identical cards.

---

## 2. Endpoints to build

### 2.1 POST /api/orders.php

Called when a customer completes checkout. Content type application/json.

**Request body** — produced verbatim by Cart.asPayload():

```json
{
  "customer": {
    "company": "Al Fajer Contracting LLC",
    "name": "Rashid Khan",
    "phone": "0551234567",
    "email": "rashid@alfajer.ae",
    "trn": "100123456700003",
    "emirate": "Dubai",
    "area": "Al Quoz",
    "address": "Warehouse 4, Street 12, Al Quoz Industrial 3",
    "logo": true,
    "logoNotes": "Left chest + full back, white print",
    "payment": "Bank transfer",
    "notes": "Needed before the 18th"
  },
  "currency": "AED",
  "items": [
    {
      "product_id": "18",
      "source": "products",
      "title": "Essential Series – General Yellow Vest",
      "category": "safety-vests",
      "unit_price": 12,
      "list_price": 12,
      "quantities": { "M": 40, "L": 60, "XL": 30 },
      "quantity_total": 130,
      "logo_printing": true,
      "note": "",
      "line_total": 1560
    }
  ],
  "totals": {
    "subtotal_ex_vat": 1560,
    "volume_discount": 0,
    "delivery": 0,
    "vat_rate": 0.05,
    "vat_amount": 78,
    "grand_total": 1638
  },
  "meta": {
    "source": "web",
    "submitted_at": "2026-08-04T09:41:22.104Z",
    "user_agent": "..."
  }
}
```

**Expected response** — 200 OK:

```json
{ "ok": true, "reference": "XO-2026-0184", "order_id": 184 }
```

The front-end reads reference (or order_reference) and shows it on the confirmation
page. Any non-2xx status makes the front-end fall back to the WhatsApp handoff, so a
failed POST never loses an order.

**Server-side responsibilities**

- Re-price every line from the database. Never trust unit_price, line_total or
  totals from the client — they are sent for reference and for the confirmation
  screen only.
- Validate quantity_total against the minimum order quantity (currently 10).
- Persist the order, then notify sales — email and/or a WhatsApp Business API message.
- Return a human-usable reference; the sales team quotes it back to the customer.

### 2.2 POST /api/inquiries.php

Called by the quote form on contact.html.

```json
{
  "company": "...", "name": "...", "phone": "...", "email": "...",
  "product": "Safety Vests", "quantity": "250",
  "logo": true, "message": "Size split to follow"
}
```

Response: { "ok": true }.

### 2.3 POST /api/quotes.php *(optional)*

Reserved in the config for a future "download a PDF quote" feature. Not called yet.

---

## 3. Switching the front-end onto the API

In assets/js/config.js:

```js
ORDER_MODE: 'whatsapp'   // current — hands off to WhatsApp, zero backend needed
ORDER_MODE: 'api'        // POST to /api/orders.php
ORDER_MODE: 'both'       // POST, and still open WhatsApp
```

Start on 'both' for a week so nothing is missed while the new pipeline is watched,
then move to 'api'.

---

## 4. CORS

The storefront is served from a different origin to the API, so the API must send:

```
Access-Control-Allow-Origin: https://www.xpertonecreative.com
Access-Control-Allow-Methods: GET, POST, OPTIONS
Access-Control-Allow-Headers: Content-Type
```

and answer OPTIONS pre-flight with 204. The existing GET endpoints already allow
cross-origin reads; the new POST endpoints will need the pre-flight handler.

While the site is being reviewed on GitHub Pages, add https://wassim2026.github.io too.

---

## 5. Commercial rules the backend must own

These are currently constants in config.js because no server owns them yet. Once the
backend exists they should move into the database and be returned with each product.

| Rule | Current value | Where it should live |
|---|---|---|
| Minimum order quantity | 10 pieces per product | Per product row |
| VAT | 5%, prices stored ex-VAT | Settings table |
| Free delivery threshold | AED 1,000 ex-VAT | Settings table |
| Delivery fee below threshold | AED 30 | Settings table |
| Volume price breaks | disabled (empty array) | Per product, or a tiers table |
| Logo printing charge | quoted manually, AED 0 inline | Per product, per print position |

PRICE_TIERS in config.js is deliberately empty. The tier machinery is built and
tested throughout the cart, the product page and the WhatsApp message — it activates the
moment real numbers are put in. Do not invent tiers without confirming them with sales.

---

## 6. Front-end architecture, in one page

```
index.html               home
shop.html                catalogue with search, category filter, sort
product.html?p={uid}     product detail + size/quantity matrix
cart.html                order review, editable quantities
checkout.html            guest checkout, no account required
order-confirmation.html  post-order summary, printable
about.html, contact.html

assets/js/config.js      every server URL and commercial rule
assets/js/store.js       XO helpers, Catalog (fetch + normalise), Pricing, Cart
assets/js/ui.js          header/footer injection, ProductCard, QtyMatrix
assets/css/main.css      design tokens + all components
data/products.json       offline snapshot of the live catalogue
```

There is no build step and no framework. Bootstrap 5 and Font Awesome load from CDN;
everything else is in this repository.

uid is {category-slug}-{id} — for example safety-vests-18. It exists because
helmet ids and vest ids overlap across the two endpoints. If the backend consolidates
onto one products table with unique ids, uid can become the plain id.

### Cart storage

The cart lives in localStorage under xo_cart_v1, so it survives a page reload and a
closed tab. It is never sent anywhere until checkout is submitted. Bump the key suffix
in config.js to invalidate everyone's cart after a breaking change to the line shape.
