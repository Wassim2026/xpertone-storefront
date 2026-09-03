/* =========================================================================
   XpertOne Prints — Data layer + cart
   -------------------------------------------------------------------------
   Exposes three globals:
     XO       — small helpers (money, slug, dom, escape…)
     Catalog  — loads + normalises products from the API or the JSON snapshot
     Cart     — cart state, persisted to localStorage, with pricing rules
   No framework, no build step.
   ========================================================================= */

(function () {
  'use strict';

  var CFG = window.XO_CONFIG;

  /* =======================================================================
     XO — helpers
     ======================================================================= */
  var XO = window.XO = {

    money: function (n, withCurrency) {
      var v = Math.round(Number(n) || 0)
        .toLocaleString('en-AE', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
      return withCurrency === false ? v : CFG.CURRENCY + ' ' + v;
    },

    int: function (v) {
      var n = parseInt(String(v).replace(/[^\d-]/g, ''), 10);
      return isNaN(n) || n < 0 ? 0 : n;
    },

    /* True while a product still carries a placeholder price, so the page can
       say so instead of quietly presenting a guess as a real number. Clear
       priceStatus in data/products.json and the wording goes away. */
    indicative: function (p) {
      return !!(p && p.priceStatus === 'indicative' && CFG.INDICATIVE);
    },

    slug: function (s) {
      return String(s).toLowerCase()
        .replace(/&amp;/g, 'and').replace(/&/g, 'and')
        .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70);
    },

    /* The API stores HTML entities (&amp;) inside plain text fields. */
    decode: function (s) {
      if (!s) return '';
      var t = document.createElement('textarea');
      t.innerHTML = String(s);
      return t.value.trim();
    },

    esc: function (s) {
      return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    },

    qs: function (name) {
      var value = new URLSearchParams(window.location.search).get(name);
      if (value) return value;
      /* Static SEO product pages use /products/<slug>/ instead of ?p=<uid>.
         Return a tagged slug so the shared product page can resolve the live
         Supabase record without embedding a database identifier in each file. */
      if (name === 'p') {
        var match = window.location.pathname.match(/^\/products\/([^/]+)\/?$/);
        if (match) return 'slug:' + decodeURIComponent(match[1]);
      }
      return null;
    },

    el: function (sel, root) { return (root || document).querySelector(sel); },
    els: function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); },

    toast: function (msg, icon) {
      var t = document.getElementById('xoToast');
      if (!t) {
        t = document.createElement('div');
        t.id = 'xoToast';
        t.className = 'xo-toast';
        t.setAttribute('role', 'status');
        t.setAttribute('aria-live', 'polite');
        document.body.appendChild(t);
      }
      t.innerHTML = '<i class="fa-solid ' + (icon || 'fa-circle-check') + '"></i><span></span>';
      t.querySelector('span').textContent = msg;
      requestAnimationFrame(function () { t.classList.add('is-visible'); });
      clearTimeout(t._timer);
      t._timer = setTimeout(function () { t.classList.remove('is-visible'); }, 2600);
    },

    waLink: function (message) {
      return 'https://wa.me/' + CFG.COMPANY.whatsapp + '?text=' + encodeURIComponent(message);
    }
  };

  /* =======================================================================
     Catalog
     ======================================================================= */
  var Catalog = window.Catalog = {

    _cache: null,
    _promise: null,

    /* Map a raw API category string onto a storefront category. */
    _categoryFor: function (raw) {
      var v = String(raw || '').trim().toLowerCase();
      for (var i = 0; i < CFG.CATEGORIES.length; i++) {
        var c = CFG.CATEGORIES[i];
        for (var k = 0; k < c.apiKeys.length; k++) {
          if (c.apiKeys[k].toLowerCase() === v) return c;
        }
      }
      return null;
    },

    /* The live data contains size typos (3Xl, 2Xl, 3X) and inconsistent
       ordering (S/L/M/XL). Normalise both. */
    _sizes: function (raw) {
      var arr = raw;
      if (typeof raw === 'string') {
        try { arr = JSON.parse(raw); } catch (e) { arr = raw ? String(raw).split(/[,/|]/) : []; }
      }
      if (!Array.isArray(arr)) arr = [];

      var fixed = arr.map(function (s) {
        var v = String(s).trim().toUpperCase();
        if (v === '3X') v = '3XL';
        if (v === '2X') v = '2XL';
        if (v === '4X') v = '4XL';
        if (v === '5X') v = '5XL';
        return v;
      }).filter(function (v, i, a) { return v && a.indexOf(v) === i; });

      fixed.sort(function (a, b) {
        var ia = CFG.SIZE_ORDER.indexOf(a), ib = CFG.SIZE_ORDER.indexOf(b);
        return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
      });
      return fixed;
    },

    _image: function (file) {
      if (!file) return '';
      var f = String(file);
      if (/^https?:\/\//i.test(f)) return f;
      f = f.replace(/^\/?uploads\//i, '');
      /* Filenames contain spaces and parentheses — encode, but keep slashes. */
      return CFG.UPLOADS_BASE + f.split('/').map(encodeURIComponent).join('/');
    },

    _normalise: function (row, sourceKey) {
      var cat = this._categoryFor(row.category) ||
                (sourceKey === 'helmets' ? this._categoryFor('helmet') : null);
      if (!cat) return null;

      var title = XO.decode(row.title);
      if (!title) return null;

      /* Test rows left in the live database. */
      if (/^test\d*$/i.test(title)) return null;

      var desc = XO.decode(row.label || '');
      var sub = XO.decode(row.sub_title || '');
      /* On vests the label column holds the description; on uniforms it
         holds a short attribute like "Front and Back Logo". */
      var isAttribute = desc && desc.length < 60;

      return {
        id: String(row.id),
      sku: row.sku || String(row.id),
      subcategory: row.subcategory || '',
        uid: cat.slug + '-' + row.id,
        source: sourceKey,
        title: title,
        slug: XO.slug(title) + '-' + row.id,
        category: cat.slug,
        categoryName: cat.name,
        price: Math.round(parseFloat(row.price || 0) * 100) / 100,
        sizes: this._sizes(row.size),
        images: [this._image(row.image_url || row.image)].filter(Boolean),
        attribute: isAttribute ? desc : '',
        description: isAttribute ? '' : desc,
        subtitle: sub
      };
    },

    _fromLive: function () {
      var self = this;
      var jobs = [
        fetch(CFG.API_BASE + CFG.ENDPOINTS.products).then(function (r) { return r.json(); })
          .then(function (j) { return { key: 'products', rows: Array.isArray(j) ? j : (j.data || []) }; }),
        fetch(CFG.API_BASE + CFG.ENDPOINTS.helmets).then(function (r) { return r.json(); })
          .then(function (j) { return { key: 'helmets', rows: Array.isArray(j) ? j : (j.data || []) }; })
          .catch(function () { return { key: 'helmets', rows: [] }; })
      ];
      return Promise.all(jobs).then(function (sets) {
        var out = [];
        sets.forEach(function (s) {
          s.rows.forEach(function (row) {
            var p = self._normalise(row, s.key);
            if (p) out.push(p);
          });
        });
        if (!out.length) throw new Error('Live catalogue returned no usable rows');
        return out;
      });
    },

    _fromLocal: function () {
      var self = this;
      return fetch('data/products.json')
        .then(function (r) { return r.json(); })
        .then(function (j) {
          var rows = Array.isArray(j) ? j : (j.products || []);
          /* The snapshot is already normalised, but run it through the same
             pipeline so both paths behave identically. */
          return rows.map(function (row) {
            return row.uid ? row : self._normalise(row, row.source || 'products');
          }).filter(Boolean);
        });
    },

    /* Live catalogue from Supabase. Prices, photos and details come from
       whatever is in the admin panel right now. Falls back to the bundled
       snapshot if Supabase is ever unreachable, so the shop never goes blank. */
    _fromSupabase: function () {
      var s = CFG.SUPABASE || {};
      /* PostgREST returns at most 1000 rows per request, so page through the
         catalogue until a short page comes back. Without this the shop
         silently drops every product past the first 1000. */
      var PAGE = 1000;
      function fetchPage(from, acc) {
        return fetch(s.url + '/rest/v1/products_public?select=*&order=sort_order', {
          headers: {
            apikey: s.key,
            'Range-Unit': 'items',
            Range: from + '-' + (from + PAGE - 1)
          },
          /* Never let the browser serve a stale catalogue. A price or photo
             changed in the admin panel must show on the next page load. */
          cache: 'no-store'
        })
          .then(function (r) {
            if (!r.ok) throw new Error('Supabase responded ' + r.status);
            return r.json();
          })
          .then(function (batch) {
            var rows = acc.concat(batch);
            return batch.length < PAGE ? rows : fetchPage(from + PAGE, rows);
          });
      }
      return fetchPage(0, [])
        .then(function (rows) {
          return rows.map(function (row) {
            return {
              id: row.sku,
              sku: row.sku,
              subcategory: row.subcategory || '',
              uid: row.category + '-' + String(row.sku).toLowerCase(),
              source: 'remart',
              title: row.title,
              slug: row.slug,
              category: row.category,
              categoryName: row.category_name,
              price: Number(row.price),
              priceStatus: row.price_is_fixed ? 'fixed' : 'indicative',
              sizes: row.sizes || [],
              images: row.images || [],
              imageSource: 'remart',
              attribute: row.attribute || '',
              description: row.description || '',
              subtitle: row.subtitle || '',
              code: '',
              features: row.features || [],
              material: row.material || '',
              colour: row.colour || '',
              origin: row.origin || '',
              standard: row.standard || '',
              packing: row.packing || '',
              gsm: row.gsm || '',
              dimensions: row.dimensions || '',
              page: row.catalogue_page || 0
            };
          });
        });
    },

    load: function () {
      var self = this;
      if (this._cache) return Promise.resolve(this._cache);
      if (this._promise) return this._promise;

      var mode = CFG.DATA_SOURCE;
      var p;
      if (mode === 'supabase') p = this._fromSupabase().catch(function (err) {
        console.warn('[XpertOne] Supabase unavailable, using bundled snapshot.', err);
        return self._fromLocal();
      });
      else if (mode === 'local') p = this._fromLocal();
      else if (mode === 'live') p = this._fromLive();
      else p = this._fromLive().catch(function (err) {
        console.warn('[XpertOne] Live catalogue unavailable, using bundled snapshot.', err);
        return self._fromLocal();
      });

      this._promise = p.then(function (list) {
        /* Stable order: category order from config, then price, then title. */
        var order = CFG.CATEGORIES.map(function (c) { return c.slug; });
        list.sort(function (a, b) {
          var d = order.indexOf(a.category) - order.indexOf(b.category);
          if (d) return d;
          if (a.price !== b.price) return a.price - b.price;
          return a.title.localeCompare(b.title);
        });
        self._cache = list;
        return list;
      });

      return this._promise;
    },

    byCategory: function (slug) {
      return this.load().then(function (list) {
        return slug && slug !== 'all'
          ? list.filter(function (p) { return p.category === slug; })
          : list;
      });
    },

    byUid: function (uid) {
      return this.load().then(function (list) {
        var slug = String(uid || '').indexOf('slug:') === 0 ? String(uid).slice(5) : '';
        for (var i = 0; i < list.length; i++) {
          if (list[i].uid === uid || (slug && list[i].slug === slug)) return list[i];
        }
        return null;
      });
    },

    /* Distinct products for the home page — one card per unique title,
       cheapest first, so the 12 near-identical uniform rows collapse. */
    highlights: function (limit) {
      return this.load().then(function (list) {
        var seen = {}, out = [];
        list.forEach(function (p) {
          var k = p.category + '|' + p.title;
          if (!seen[k]) { seen[k] = 1; out.push(p); }
        });
        return out.slice(0, limit || 8);
      });
    }
  };

  /* =======================================================================
     Pricing
     ======================================================================= */
  var Pricing = window.Pricing = {

    tierFor: function (qty) {
      var best = null;
      (CFG.PRICE_TIERS || []).forEach(function (t) {
        if (qty >= t.min && (!best || t.min > best.min)) best = t;
      });
      return best;
    },

    unitPrice: function (basePrice, qty) {
      var t = this.tierFor(qty);
      var p = t ? basePrice * (1 - t.discount) : basePrice;
      return Math.round(p * 100) / 100;
    },

    lineTotal: function (basePrice, qty) {
      return Math.round(this.unitPrice(basePrice, qty) * qty * 100) / 100;
    }
  };

  /* =======================================================================
     Cart
     ======================================================================= */
  var Cart = window.Cart = {

    _read: function () {
      try {
        var raw = localStorage.getItem(CFG.CART_KEY);
        var v = raw ? JSON.parse(raw) : [];
        return Array.isArray(v) ? v : [];
      } catch (e) { return []; }
    },

    _write: function (lines) {
      try { localStorage.setItem(CFG.CART_KEY, JSON.stringify(lines)); } catch (e) {}
      document.dispatchEvent(new CustomEvent('cart:change', { detail: { lines: lines } }));
      return lines;
    },

    lines: function () { return this._read(); },

    count: function () {
      return this._read().reduce(function (n, l) { return n + Cart.lineQty(l); }, 0);
    },

    lineQty: function (line) {
      return Object.keys(line.qty || {}).reduce(function (n, s) { return n + (line.qty[s] || 0); }, 0);
    },

    /* qtyBySize: { S: 20, M: 40, ... } — zero values are dropped. */
    add: function (product, qtyBySize, options) {
      var clean = {}, total = 0;
      Object.keys(qtyBySize || {}).forEach(function (s) {
        var n = XO.int(qtyBySize[s]);
        if (n > 0) { clean[s] = n; total += n; }
      });
      if (!total) return { ok: false, reason: 'empty' };

      var lines = this._read();
      var opts = options || {};
      var key = product.uid + '|' + (opts.logo ? 'logo' : 'plain');
      var existing = null;
      for (var i = 0; i < lines.length; i++) if (lines[i].key === key) { existing = lines[i]; break; }

      if (existing) {
        Object.keys(clean).forEach(function (s) {
          existing.qty[s] = (existing.qty[s] || 0) + clean[s];
        });
      } else {
        lines.push({
          key: key,
          uid: product.uid,
          id: product.id,
          source: product.source,
          title: product.title,
          category: product.category,
          categoryName: product.categoryName,
          price: product.price,
          priceStatus: product.priceStatus || '',
          image: product.images[0] || '',
          qty: clean,
          logo: !!opts.logo,
          note: opts.note || ''
        });
      }
      this._write(lines);
      return { ok: true, added: total };
    },

    setQty: function (key, size, qty) {
      var lines = this._read();
      lines.forEach(function (l) {
        if (l.key !== key) return;
        var n = XO.int(qty);
        if (n > 0) l.qty[size] = n; else delete l.qty[size];
      });
      lines = lines.filter(function (l) { return Cart.lineQty(l) > 0; });
      return this._write(lines);
    },

    remove: function (key) {
      return this._write(this._read().filter(function (l) { return l.key !== key; }));
    },

    clear: function () { return this._write([]); },

    totals: function () {
      var lines = this._read();
      var subtotal = 0, units = 0, savings = 0;

      lines.forEach(function (l) {
        var q = Cart.lineQty(l);
        units += q;
        var full = l.price * q;
        var net = Pricing.lineTotal(l.price, q);
        subtotal += net;
        savings += (full - net);
        if (l.logo && CFG.LOGO_PRINTING.pricePerUnit > 0) {
          subtotal += CFG.LOGO_PRINTING.pricePerUnit * q;
        }
      });

      subtotal = Math.round(subtotal * 100) / 100;
      var delivery = (units === 0 || subtotal >= CFG.FREE_DELIVERY_THRESHOLD) ? 0 : CFG.DELIVERY_FEE;
      var vat = Math.round((subtotal + delivery) * CFG.VAT_RATE * 100) / 100;
      var grand = Math.round((subtotal + delivery + vat) * 100) / 100;

      return {
        lines: lines.length,
        units: units,
        subtotal: subtotal,
        savings: Math.round(savings * 100) / 100,
        delivery: delivery,
        vat: vat,
        total: grand
      };
    },

    /* Builds the human-readable order used for the WhatsApp handoff and for
       the confirmation screen. */
    asMessage: function (customer) {
      var t = this.totals();
      var out = ['*NEW ORDER — XpertOne Prints*', ''];

      this._read().forEach(function (l, i) {
        var q = Cart.lineQty(l);
        var sizes = Object.keys(l.qty)
          .sort(function (a, b) { return CFG.SIZE_ORDER.indexOf(a) - CFG.SIZE_ORDER.indexOf(b); })
          .map(function (s) { return s + ' x' + l.qty[s]; }).join(', ');
        out.push((i + 1) + '. ' + l.title);
        if (sizes) out.push('   Sizes: ' + sizes);
        out.push('   Qty: ' + q + '  |  Unit: ' + XO.money(Pricing.unitPrice(l.price, q)) +
                 '  |  Line: ' + XO.money(Pricing.lineTotal(l.price, q)));
        if (l.logo) out.push('   Logo printing: yes');
        if (l.note) out.push('   Note: ' + l.note);
        out.push('');
      });

      out.push('Subtotal (ex VAT): ' + XO.money(t.subtotal));
      if (t.savings > 0) out.push('Volume discount: -' + XO.money(t.savings));
      out.push('Delivery: ' + (t.delivery ? XO.money(t.delivery) : 'Free'));
      out.push('VAT 5%: ' + XO.money(t.vat));
      out.push('*Total: ' + XO.money(t.total) + '*');

      if (customer) {
        out.push('', '---', 'Company: ' + (customer.company || '-'),
                 'Contact: ' + (customer.name || '-'),
                 'Phone: ' + (customer.phone || '-'),
                 'Email: ' + (customer.email || '-'),
                 'Emirate: ' + (customer.emirate || '-'),
                 'Address: ' + (customer.address || '-'),
                 'Payment: ' + (customer.payment || '-'));
        if (customer.trn) out.push('TRN: ' + customer.trn);
        if (customer.notes) out.push('Notes: ' + customer.notes);
      }
      return out.join('\n');
    },

    /* Machine-readable payload — this is exactly what POST /api/orders.php
       should expect. Documented in docs/API.md. */
    asPayload: function (customer) {
      var t = this.totals();
      return {
        customer: customer || {},
        currency: CFG.CURRENCY,
        items: this._read().map(function (l) {
          var q = Cart.lineQty(l);
          return {
            product_id: l.id,
            source: l.source,
            title: l.title,
            category: l.category,
            unit_price: Pricing.unitPrice(l.price, q),
            list_price: l.price,
            quantities: l.qty,
            quantity_total: q,
            logo_printing: !!l.logo,
            note: l.note || '',
            line_total: Pricing.lineTotal(l.price, q)
          };
        }),
        totals: {
          subtotal_ex_vat: t.subtotal,
          volume_discount: t.savings,
          delivery: t.delivery,
          vat_rate: CFG.VAT_RATE,
          vat_amount: t.vat,
          grand_total: t.total
        },
        meta: {
          source: 'web',
          submitted_at: new Date().toISOString(),
          user_agent: navigator.userAgent
        }
      };
    }
  };

})();
