# Xpertone Creative LLC-FZ — storefront

A rebuild of the Xpertone Creative LLC-FZ ordering experience: static front-end, no build step, ready
for a backend developer to wire up.

**Live preview:** https://wassim2026.github.io/xpertone-storefront/

---

## Why this exists

The previous site made ordering harder than phoning. Three things in particular:

1. **A pop-up blocked every page.** An "Inquiry Form" modal loaded on the homepage,
   category pages, cart and checkout, with no close button and no way to dismiss it with
   Escape or a click outside. Nobody could see a price without submitting it.
2. **Quantities could only be entered one click at a time.** Each product had eight size
   rows with minus and plus buttons and a read-only number. Ordering 130 vests meant 130
   clicks. At this business's order sizes the flow was unusable, which is why buyers
   ended up in the WhatsApp inbox instead.
3. **Thirteen products rendered on a single page** with every size stepper expanded —
   over a hundred controls on screen — and there were no individual product pages, so
   nothing could be linked, shared or ranked.

This rebuild fixes all three, plus: guest checkout instead of a login wall, an empty
state on the cart and checkout pages, MOQ / VAT / delivery stated on the product page,
dead navigation links removed, and one floating widget instead of four.

---

## Running it locally

No build, no dependencies. Any static server works:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

Opening `index.html` straight off disk also works, except that the offline catalogue
snapshot in `data/products.json` will not load over `file://`. The live API still will.

---

## How the data flows

By default the storefront reads the **live catalogue** from the existing PHP API and
falls back to a bundled JSON snapshot if that is unreachable:

```js
// assets/js/config.js
DATA_SOURCE: 'auto'   // 'live' | 'local' | 'auto'
```

| Value | Behaviour |
|---|---|
| `live` | Always fetch api.xpertoneprints.com. Prices and images are always current. |
| `local` | Always use `data/products.json`. Useful for demos and offline review. |
| `auto` | Try live, fall back to the snapshot. **Default.** |

The snapshot in `data/products.json` was generated from the live API and holds all 51
real products. Regenerate it whenever the catalogue changes:

```bash
curl -s https://api.xpertoneprints.com/api/safety_products.php > /tmp/a.json
curl -s https://api.xpertoneprints.com/api/helmets.php        > /tmp/h.json
# merge the two arrays, strip the /uploads/ prefix from image, and write data/products.json
```

The cleanest long-term fix is a single server-side endpoint that returns the whole
catalogue — see docs/API.md.

---

## Orders

Out of the box, checkout builds a fully itemised order message and hands it to
WhatsApp — the channel this business already sells through. That means the site is
commercially usable with **no backend at all**.

When the backend is ready, change one line:

```js
ORDER_MODE: 'whatsapp'  ->  'both'  ->  'api'
```

The full request and response contract is in **[docs/API.md](docs/API.md)**. That is the
document to hand to the developer.

---

## What a developer needs to build

Three POST endpoints — orders, inquiries, and (optionally) quotes — plus CORS headers.
Everything else is done. See docs/API.md section 2.

There is also a list of data problems to fix at the source in docs/API.md section 1: size
typos, HTML entities in titles, an overloaded `label` column, test rows left in the
production database, and 26 uniform rows that should collapse into 5 products with
colour variants.

---

## Repository layout

```
index.html                 home
shop.html                  catalogue — search, category filter, sort
product.html               product detail + size/quantity matrix
cart.html                  order review with editable quantities
checkout.html              guest checkout
order-confirmation.html    printable order summary
about.html
contact.html               bulk quote request form
404.html

assets/css/main.css        design tokens and every component
assets/js/config.js        all server URLs and commercial rules — start here
assets/js/store.js         helpers, catalogue loader, pricing, cart
assets/js/ui.js            header/footer, product card, quantity matrix

data/products.json         offline catalogue snapshot (51 products)
docs/API.md                backend contract — hand this to the developer
```

---

## Configuration cheat sheet

Everything below lives in `assets/js/config.js`:

| Setting | Purpose |
|---|---|
| `API_BASE`, `ENDPOINTS` | Where the server is |
| `DATA_SOURCE` | Live API, local snapshot, or auto |
| `ORDER_MODE` | WhatsApp handoff, API POST, or both |
| `MOQ` | Minimum order quantity, currently 10 |
| `VAT_RATE` | 5% |
| `FREE_DELIVERY_THRESHOLD`, `DELIVERY_FEE` | AED 1,000 / AED 30 |
| `PRICE_TIERS` | Volume discounts — built, empty until real numbers are confirmed |
| `COMPANY` | Phone, WhatsApp number, email, address, TRN |
| `CATEGORIES` | Add a category here and it appears in the nav, home page and filters |

---

## Notes on the domain

The old site serves xpertonecreative.com but its canonical tag and page title both
point at xpertoneprints.com, which splits search authority between two domains. Pick
one, 301 the other to it, and make the canonical tags match. The canonical link in
`index.html` currently points at xpertonecreative.com — change it if you settle on the
other domain.

---

## Browser support

Evergreen Chrome, Safari, Firefox and Edge, plus iOS Safari and Chrome on Android.
The JavaScript is ES5-compatible with the exception of fetch, Promise and
URLSearchParams, all of which have been in every shipping browser since 2017.

---

## Brand kit (internal — sales team)

`brand-kit.html` is a private page for the sales team. It is marked `noindex` and is
not linked from anywhere on the site; the team reaches it by bookmarking the URL.

Give it a client's company name, contact number and logo, and it brands every item in
the catalogue on the chest and across the back automatically, using the same placement
engine as the customer-facing designer. Sleeve printing is an extra tick, deliberately
off by default. The output downloads as a ZIP of PNGs plus a `details.txt` covering
letter, or as a one-page-per-item PDF catalogue.

Client records live in `localStorage` under `xo_clients_v1` and can be exported to a
JSON file and imported on another machine.

**For the backend developer.** The export file is the intended migration path. Its
shape is:

```json
{ "format": "xpertone-clients", "version": 1, "exported": "<ISO date>",
  "clients": [ { "id": "...", "company": "...", "companyAr": "...", "phone": "...",
                 "contact": "...", "notes": "...", "colour": "#FFFFFF",
                 "sleeves": false, "logo": "data:image/png;base64,...",
                 "logoName": "...", "picks": ["safety-vests-6", "..."],
                 "created": "<ISO>", "updated": "<ISO>" } ] }
```

Once real accounts exist server-side, POST that array and have `Clients.all()` read
from the API instead of `localStorage`. Everything else on the page is unchanged.
Note that browser storage is capped at roughly 5 MB, so a team working from the
browser alone should export regularly — the page shows how much room is left.

Two files support it, and nothing else on the site depends on them:

| File | Purpose |
|---|---|
| `assets/js/brandkit.js` | The tool itself |
| `assets/js/pack.js` | ZIP and PDF writers, written from scratch so there is no third-party dependency |
