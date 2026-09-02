/* =========================================================================
   XpertOne Prints — Shared UI
   -------------------------------------------------------------------------
   Injects the header and footer into every page (so there is one copy to
   maintain), keeps the cart badge live, and provides the two reusable
   components: the product card and the size/quantity matrix.
   ========================================================================= */

(function () {
  'use strict';

  var CFG = window.XO_CONFIG;
  var C = CFG.COMPANY;

  /* =======================================================================
     Header / footer
     ======================================================================= */
    /* ---------------------------------------------------------------------
     Navigation model
     ---------------------------------------------------------------------
     Fourteen flat ranges will not fit in a bar, and someone hunting for
     gloves should not have to guess which link hides them. So the ranges
     are grouped into four shopping intents; each group opens a panel
     listing the categories under it with a live product count. A category
     holding nothing is dropped rather than shown as an empty dead end.
     --------------------------------------------------------------------- */
  var NAV_GROUPS = [
    { key: 'workwear', label: 'Workwear',
      cats: ['safety-vests', 'uniforms', 'rainwear-marine'] },
    { key: 'ppe', label: 'Personal Protection',
      cats: ['safety-shoes', 'hand-protection', 'helmets', 'eye-face-protection', 'hearing-respiratory'] },
    { key: 'site', label: 'Site & Traffic',
      cats: ['traffic-safety'] },
    { key: 'tools', label: 'Tools & Equipment',
      cats: ['hardware-tools', 'automotive'] }
  ];

  var CAT_COUNTS = null;
  var SUBS = {};

  function catMeta(slug) {
    var list = CFG.CATEGORIES || [];
    for (var i = 0; i < list.length; i++) { if (list[i].slug === slug) return list[i]; }
    return { slug: slug, name: slug };
  }

  function catCount(slug) { return CAT_COUNTS ? (CAT_COUNTS[slug] || 0) : null; }

  function totalCount() {
    if (!CAT_COUNTS) return 0;
    var n = 0; for (var k in CAT_COUNTS) { n += CAT_COUNTS[k]; } return n;
  }

  /* Before counts land we show everything, so the first paint is never bare. */
  function visibleCats(g) {
    return g.cats.filter(function (s) { var n = catCount(s); return n === null ? true : n > 0; });
  }

  function headerStyles() {
    if (document.getElementById('xoNavCss')) return;
    var css =
      '.xo-nav{background:#12151b}' +
      '.xo-nav__inner{display:flex;align-items:stretch;gap:2px;flex-wrap:nowrap;overflow:visible}' +
      '.xo-nav a,.xo-nav button{color:#e8eaed;text-decoration:none;font-weight:600;font-size:14px;background:none;border:0;padding:13px 14px;display:inline-flex;align-items:center;gap:6px;white-space:nowrap;line-height:1}' +
      '.xo-nav a:hover,.xo-nav button:hover,.xo-nav a.is-active{color:#f5b301}' +
      '.xo-nav a.is-active{box-shadow:inset 0 -3px 0 #f5b301}' +
      '.xo-grp{position:relative;display:inline-flex}' +
      '.xo-mega{position:absolute;left:0;top:100%;z-index:1050;min-width:560px;background:#fff;border:1px solid #e6e8ec;border-radius:0 0 14px 14px;box-shadow:0 20px 44px rgba(15,17,21,.2);padding:14px;display:none}' +
      '.xo-grp:hover .xo-mega,.xo-grp:focus-within .xo-mega{display:block}' +
      '.xo-mega__grid{display:grid;grid-template-columns:1fr 1fr;gap:2px}' +
      '.xo-mega a{color:#12151b;padding:10px 11px;border-radius:9px;display:flex;justify-content:space-between;align-items:center;gap:10px;font-weight:600;font-size:14px}' +
      '.xo-mega a:hover{background:#f5f6f8;color:#12151b}' +
      '.xo-mega__n{color:#98a1ae;font-weight:600;font-size:12px}' +
      '.xo-mega__all{display:block;margin-top:8px;padding-top:10px;border-top:1px solid #eceef2;font-size:13px}' +
      '.xo-tag{font-size:10px;text-transform:uppercase;letter-spacing:.4px;background:#fff3cd;color:#8a6100;border-radius:999px;padding:2px 7px;font-weight:700}' +
      '.xo-search{position:relative;flex:1;max-width:460px}' +
      '.xo-search input{width:100%;border:1px solid #dfe3e8;border-radius:10px;padding:10px 14px 10px 38px;font-size:14px;background:#fff}' +
      '.xo-search input:focus{outline:2px solid #f5b301;outline-offset:0;border-color:#f5b301}' +
      '.xo-search .fa-magnifying-glass{position:absolute;left:13px;top:50%;transform:translateY(-50%);color:#98a1ae;font-size:13px}' +
      '.xo-mnav details{border-bottom:1px solid #eceef2}' +
      '.xo-mnav summary{list-style:none;cursor:pointer;padding:13px 2px;font-weight:700;display:flex;justify-content:space-between;align-items:center}' +
      '.xo-mnav summary::-webkit-details-marker{display:none}' +
      '.xo-mnav a{display:flex;justify-content:space-between;padding:10px 10px;border-radius:8px;color:#12151b;text-decoration:none;font-size:14px;font-weight:600}' +
      '.xo-mnav a:hover{background:#f5f6f8}' +
      '.xo-mnav>a{padding:13px 2px;border-bottom:1px solid #eceef2;border-radius:0}' +
      '.xo-mega__cols{display:grid;gap:14px}' +
      '.xo-col__head{display:flex;justify-content:space-between;align-items:center;gap:8px;font-weight:700;font-size:14px;color:#12151b;padding:6px 8px;border-radius:8px;text-decoration:none}' +
      '.xo-col__head:hover{background:#f5f6f8}' +
      '.xo-col__sub{display:flex;justify-content:space-between;gap:8px;font-weight:500;font-size:13px;color:#5b6472;padding:5px 8px 5px 16px;border-radius:8px;text-decoration:none}' +
      '.xo-col__sub:hover{background:#f5f6f8;color:#12151b}' +
      '.xo-col__more{display:block;font-size:12px;color:#8a93a2;padding:4px 8px 4px 16px;text-decoration:none}' +
      '.product-card__sku{margin-left:6px;font-size:11px;letter-spacing:.4px;color:#98a1ae;font-weight:700}' +
      '@media(max-width:1199.98px){.xo-nav{display:none}}';
    var s = document.createElement('style');
    s.id = 'xoNavCss';
    s.appendChild(document.createTextNode(css));
    document.head.appendChild(s);
  }

  function catLink(slug, withTag) {
    var m = catMeta(slug), n = catCount(slug);
    return '<a href="shop.html?category=' + slug + '">' +
      '<span>' + XO.esc(m.name) + (withTag && m.printable ? ' <span class="xo-tag">logo</span>' : '') + '</span>' +
      (n === null ? '' : '<span class="xo-mega__n">' + n + '</span>') + '</a>';
  }

  function megaFor(g) {
    var cats = visibleCats(g);
    var cols = cats.map(function (slug) {
      var m = catMeta(slug), n = catCount(slug);
      var subs = (SUBS[slug] || []).slice(0, 5);
      var head = '<a class="xo-col__head" href="shop.html?category=' + slug + '">' +
        '<span>' + XO.esc(m.name) + (m.printable ? ' <span class="xo-tag">logo</span>' : '') + '</span>' +
        (n === null ? '' : '<span class="xo-mega__n">' + n + '</span>') + '</a>';
      var kids = subs.map(function (s) {
        return '<a class="xo-col__sub" href="shop.html?category=' + slug + '&q=' + encodeURIComponent(s.name) + '">' +
          '<span>' + XO.esc(s.name) + '</span><span class="xo-mega__n">' + s.n + '</span></a>';
      }).join('');
      var more = (SUBS[slug] || []).length > 5
        ? '<a class="xo-col__more" href="shop.html?category=' + slug + '">All ' + XO.esc(m.name) + '</a>' : '';
      return '<div>' + head + kids + more + '</div>';
    }).join('');
    var tot = totalCount();
    var wide = cats.length > 3;
    return '<div class="xo-mega"' + (wide ? ' style="min-width:760px"' : '') + '>' +
      '<div class="xo-mega__cols" style="grid-template-columns:repeat(' + Math.min(cats.length, 3) + ',minmax(220px,1fr))">' + cols + '</div>' +
      '<a class="xo-mega__all" href="shop.html">Browse all' + (tot ? ' ' + tot : '') + ' products</a></div>';
  }

  function navBar(active) {
    var out = '<a href="index.html"' + (active === 'home' ? ' class="is-active"' : '') + '>Home</a>' +
              '<a href="shop.html"' + (active === 'shop' ? ' class="is-active"' : '') + '>Shop All</a>';
    NAV_GROUPS.forEach(function (g) {
      if (!visibleCats(g).length) return;
      out += '<span class="xo-grp"><button type="button" aria-haspopup="true">' + XO.esc(g.label) +
             ' <i class="fa-solid fa-chevron-down" style="font-size:9px;opacity:.7"></i></button>' + megaFor(g) + '</span>';
    });
    out += '<a href="about.html"' + (active === 'about' ? ' class="is-active"' : '') + '>About</a>' +
           '<a href="contact.html"' + (active === 'contact' ? ' class="is-active"' : '') + '>Contact</a>';
    return out;
  }

  function mobileNavHtml() {
    var out = '<a href="index.html">Home</a><a href="shop.html">Shop All</a>';
    NAV_GROUPS.forEach(function (g) {
      var cats = visibleCats(g);
      if (!cats.length) return;
      out += '<details><summary>' + XO.esc(g.label) + '<i class="fa-solid fa-chevron-down" style="font-size:11px;opacity:.5"></i></summary>' +
             '<div style="padding-bottom:8px">' + cats.map(function (s) { return catLink(s, false); }).join('') + '</div></details>';
    });
    out += '<a href="about.html">About</a><a href="contact.html">Contact</a>';
    return out;
  }

  /* Kept because other pages still call it. */
  function navLinks(active) { return navBar(active); }

  function loadCounts(done) {
    if (CAT_COUNTS) { done(); return; }
    try {
      var cached = sessionStorage.getItem('xo_cat_counts');
      if (cached) { CAT_COUNTS = JSON.parse(cached); done(); return; }
    } catch (e) {}
    var s = CFG.SUPABASE || {};
    if (!s.url) { done(); return; }
    fetch(s.url + '/rest/v1/nav_tree?select=category,subcategory,subcategory_slug,product_count', { headers: { apikey: s.key } })
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (rows) {
        var by = {};
        rows.forEach(function (r) {
          (by[r.category] = by[r.category] || []).push({ name: r.subcategory, slug: r.subcategory_slug, n: r.product_count });
        });
        Object.keys(by).forEach(function (k) { by[k].sort(function (a, b) { return b.n - a.n; }); });
        SUBS = by;
      })
      ['catch'](function () {})
      .then(function () {
    return fetch(s.url + '/rest/v1/category_counts?select=slug,product_count', { headers: { apikey: s.key } })
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (rows) {
        var m = {};
        rows.forEach(function (r) { m[r.slug] = r.product_count; });
        CAT_COUNTS = m;
        try { sessionStorage.setItem('xo_cat_counts', JSON.stringify(m)); } catch (e) {}
      })
      ['catch'](function () {})
      .then(function () { done(); });
      });
  }

  function renderHeader(active) {
    var mount = document.getElementById('siteHeader');
    if (!mount) return;
    headerStyles();

    mount.innerHTML =
      '<div class="topbar d-none d-lg-block"><div class="container d-flex justify-content-between align-items-center">' +
        '<div class="d-flex gap-4">' +
          '<span class="topbar__item"><i class="fa-solid fa-location-dot"></i> Al Quoz 4, Dubai</span>' +
          '<span class="topbar__item"><i class="fa-solid fa-clock"></i> ' + XO.esc(C.hours) + '</span>' +
        '</div>' +
        '<div class="d-flex gap-4">' +
          '<a class="topbar__item" href="tel:+' + C.phoneRaw + '"><i class="fa-solid fa-phone"></i> ' + XO.esc(C.phone) + '</a>' +
          '<a class="topbar__item" href="mailto:' + C.email + '"><i class="fa-solid fa-envelope"></i> ' + XO.esc(C.email) + '</a>' +
        '</div>' +
      '</div></div>' +

      '<header class="site-header"><div class="container"><div class="site-header__inner">' +
        '<a class="brand" href="index.html">' +
          '<span class="brand__mark">X1</span>' +
          '<span><span class="brand__name">XpertOne</span><span class="brand__tag">Prints &amp; Safety</span></span>' +
        '</a>' +

        '<form class="xo-search d-none d-lg-block mx-3" id="xoSearchForm" role="search">' +
          '<i class="fa-solid fa-magnifying-glass"></i>' +
          '<input type="search" id="xoSearchInput" placeholder="Search 1,200+ products — vest, S3 shoe, welding glove, cone" aria-label="Search products">' +
        '</form>' +

        '<div class="header-actions ms-auto ms-lg-0">' +
          '<a class="btn btn-outline-xo btn-sm-xo d-none d-md-inline-flex" href="contact.html#quote">' +
            '<i class="fa-solid fa-file-invoice"></i> Request a quote</a>' +
          '<a class="btn btn-ink btn-sm-xo cart-btn" href="cart.html" aria-label="Cart">' +
            '<i class="fa-solid fa-cart-shopping"></i>' +
            '<span class="d-none d-sm-inline">Cart</span>' +
            '<span class="cart-btn__count" id="cartCount" data-empty="true">0</span>' +
          '</a>' +
          '<button class="btn btn-outline-xo btn-sm-xo d-xl-none" type="button" ' +
            'data-bs-toggle="offcanvas" data-bs-target="#mobileNav" aria-label="Menu">' +
            '<i class="fa-solid fa-bars"></i></button>' +
        '</div>' +
      '</div></div></header>' +

      '<div class="xo-nav d-none d-xl-block"><div class="container"><div class="xo-nav__inner" id="xoNavInner">' +
        navBar(active) +
      '</div></div></div>' +

      '<div class="offcanvas offcanvas-end" tabindex="-1" id="mobileNav" aria-label="Menu">' +
        '<div class="offcanvas-header border-bottom">' +
          '<span class="brand"><span class="brand__mark">X1</span>' +
          '<span><span class="brand__name">XpertOne</span><span class="brand__tag">Prints &amp; Safety</span></span></span>' +
          '<button type="button" class="btn-close" data-bs-dismiss="offcanvas" aria-label="Close"></button>' +
        '</div>' +
        '<div class="offcanvas-body">' +
          '<form class="xo-search mb-3" id="xoSearchFormM" role="search">' +
            '<i class="fa-solid fa-magnifying-glass"></i>' +
            '<input type="search" id="xoSearchInputM" placeholder="Search products" aria-label="Search products">' +
          '</form>' +
          '<nav class="xo-mnav d-flex flex-column" id="xoMobileNav" aria-label="Main">' + mobileNavHtml() + '</nav>' +
          '<a class="btn btn-gold w-100 mt-3" href="contact.html#quote">Request a quote</a>' +
        '</div>' +
      '</div>';

    /* Search jumps to the shop and pre-fills its filter box. */
    function wireSearch(formId, inputId) {
      var f = document.getElementById(formId);
      if (!f) return;
      f.addEventListener('submit', function (e) {
        e.preventDefault();
        var v = (document.getElementById(inputId).value || '').trim();
        location.href = 'shop.html' + (v ? '?q=' + encodeURIComponent(v) : '');
      });
    }
    wireSearch('xoSearchForm', 'xoSearchInput');
    wireSearch('xoSearchFormM', 'xoSearchInputM');

    /* Counts arrive a moment later; redraw so empty ranges disappear. */
    loadCounts(function () {
      var d = document.getElementById('xoNavInner');
      if (d) d.innerHTML = navBar(active);
      var m = document.getElementById('xoMobileNav');
      if (m) m.innerHTML = mobileNavHtml();
    });
  }

  /* Carry a header search term into the shop page's own filter. */
  function applySearchParam() {
    var q = null;
    try { q = new URLSearchParams(location.search).get('q'); } catch (e) { return; }
    if (!q) return;
    var tries = 0;
    var timer = setInterval(function () {
      var box = document.getElementById('searchBox');
      if (box) {
        box.value = q;
        box.dispatchEvent(new Event('input', { bubbles: true }));
        clearInterval(timer);
      } else if (++tries > 40) { clearInterval(timer); }
    }, 100);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applySearchParam);
  } else { applySearchParam(); }

  function renderFooter() {
    var mount = document.getElementById('siteFooter');
    if (!mount) return;

    var catLinks = CFG.CATEGORIES.map(function (c) {
      return '<li><a href="shop.html?category=' + c.slug + '">' + XO.esc(c.name) + '</a></li>';
    }).join('');

    mount.innerHTML =
      '<footer class="site-footer"><div class="container">' +
        '<div class="row g-4 g-lg-5">' +
          '<div class="col-lg-4">' +
            '<span class="brand mb-3"><span class="brand__mark">X1</span>' +
            '<span><span class="brand__name text-white">XpertOne</span>' +
            '<span class="brand__tag">Prints &amp; Safety</span></span></span>' +
            '<p style="font-size:.92rem;max-width:34ch">Bulk safety wear and custom uniform printing for UAE ' +
            'construction, logistics and facilities teams. Supplied from our Al Quoz warehouse.</p>' +
            '<a class="btn btn-wa btn-sm-xo" href="' + XO.waLink('Hello XpertOne, I would like a quote.') + '" target="_blank" rel="noopener">' +
            '<i class="fa-brands fa-whatsapp"></i> Chat with sales</a>' +
          '</div>' +
          '<div class="col-6 col-lg-2"><h4>Shop</h4><ul>' + catLinks +
            '<li><a href="shop.html">All products</a></li></ul></div>' +
          '<div class="col-6 col-lg-2"><h4>Company</h4><ul>' +
            '<li><a href="about.html">About us</a></li>' +
            '<li><a href="contact.html">Contact</a></li>' +
            '<li><a href="contact.html#quote">Request a quote</a></li>' +
            '<li><a href="shop.html">Bulk pricing</a></li></ul></div>' +
          '<div class="col-lg-4"><h4>Get in touch</h4><ul class="footer-contact">' +
            '<li><i class="fa-solid fa-location-dot"></i><span>' + XO.esc(C.address) + '</span></li>' +
            '<li><i class="fa-solid fa-phone"></i><a href="tel:+' + C.phoneRaw + '">' + XO.esc(C.phone) + '</a></li>' +
            '<li><i class="fa-solid fa-envelope"></i><a href="mailto:' + C.email + '">' + XO.esc(C.email) + '</a></li>' +
            '<li><i class="fa-solid fa-clock"></i><span>' + XO.esc(C.hours) + '</span></li>' +
          '</ul></div>' +
        '</div>' +
        '<div class="site-footer__bottom">' +
          '<span>&copy; ' + new Date().getFullYear() + ' ' + XO.esc(C.legalName) + '. All rights reserved.</span>' +
          '<span>Prices exclude 5% VAT · Trade enquiries welcome</span>' +
        '</div>' +
      '</div></footer>';
  }

  function renderWhatsAppFab() {
    if (document.querySelector('.wa-float')) return;
    var a = document.createElement('a');
    a.className = 'wa-float';
    a.href = XO.waLink('Hello XpertOne, I have a question about your products.');
    a.target = '_blank';
    a.rel = 'noopener';
    a.innerHTML = '<i class="fa-brands fa-whatsapp"></i><span>Chat with sales</span>';
    document.body.appendChild(a);
  }

  function syncCartBadge() {
    var n = Cart.count();
    XO.els('#cartCount').forEach(function (b) {
      b.textContent = n > 99 ? '99+' : n;
      b.setAttribute('data-empty', n === 0 ? 'true' : 'false');
    });
  }

  /* =======================================================================
     Product card
     ======================================================================= */
  window.ProductCard = function (p) {
    var sizes = p.sizes.length ? p.sizes.join(' · ') : 'One size';
    var badge = p.attribute
      ? '<span class="badge-xo badge-xo--amber product-card__badge">' + XO.esc(p.attribute) + '</span>'
      : '';
    var ind = XO.indicative(p);
    return '' +
      '<div class="col-6 col-lg-4 col-xl-3">' +
        '<article class="product-card">' +
          badge +
          '<a class="product-card__media" href="product.html?p=' + encodeURIComponent(p.uid) + '" aria-label="' + XO.esc(p.title) + '">' +
            (p.images[0]
              ? '<img src="' + XO.esc(p.images[0]) + '" alt="' + XO.esc(p.title) + '" loading="lazy" decoding="async">'
              : '<i class="fa-solid fa-image fa-2x text-muted-xo"></i>') +
          '</a>' +
          '<div class="product-card__body">' +
            '<span class="product-card__cat">' + XO.esc(p.subcategory || p.categoryName) +
              (p.sku ? '<span class="product-card__sku">' + XO.esc(p.sku) + '</span>' : '') + '</span>' +
            '<h3 class="product-card__title"><a href="product.html?p=' + encodeURIComponent(p.uid) + '">' + XO.esc(p.title) + '</a></h3>' +
            '<div class="product-card__sizes"><i class="fa-solid fa-ruler"></i> ' + XO.esc(sizes) + '</div>' +
            '<div class="product-card__foot">' +
              '<div class="product-card__price"><b class="num">' + XO.money(p.price) + '</b>' +
                '<span>' + (ind ? 'indicative, ex VAT' : 'per piece, ex VAT') + '</span></div>' +
              '<a class="btn btn-xo btn-sm-xo" href="product.html?p=' + encodeURIComponent(p.uid) + '">' +
                'Order <i class="fa-solid fa-arrow-right"></i></a>' +
            '</div>' +
          '</div>' +
        '</article>' +
      '</div>';
  };

  window.ProductGrid = function (mountSel, products, emptyMsg) {
    var mount = XO.el(mountSel);
    if (!mount) return;
    if (!products.length) {
      mount.innerHTML = '<div class="col-12"><div class="empty-state">' +
        '<div class="empty-state__icon"><i class="fa-solid fa-box-open"></i></div>' +
        '<h3>' + XO.esc(emptyMsg || 'Nothing here yet') + '</h3>' +
        '<p class="text-muted-xo">Try another category, or ask us directly — we carry more than we list.</p>' +
        '<a class="btn btn-wa" href="' + XO.waLink('Hello XpertOne, do you stock ') + '" target="_blank" rel="noopener">' +
        '<i class="fa-brands fa-whatsapp"></i> Ask on WhatsApp</a></div></div>';
      return;
    }
    mount.innerHTML = products.map(ProductCard).join('');
  };

  window.GridSkeleton = function (mountSel, n) {
    var mount = XO.el(mountSel);
    if (!mount) return;
    var one = '<div class="col-6 col-lg-4 col-xl-3"><div class="skeleton skeleton-card"></div></div>';
    mount.innerHTML = new Array(n || 8).fill(one).join('');
  };

  /* =======================================================================
     Size / quantity matrix
     -----------------------------------------------------------------------
     The fix for the old site: every size is a typeable number field, with
     quick-fill shortcuts, a live running total and MOQ validation.
     ======================================================================= */
  window.QtyMatrix = function (opts) {
    var mount = typeof opts.mount === 'string' ? XO.el(opts.mount) : opts.mount;
    if (!mount) return null;

    var product = opts.product;
    var sizes = product.sizes.length ? product.sizes : ['One size'];
    var state = {};
    sizes.forEach(function (s) { state[s] = 0; });

    mount.innerHTML =
      '<div class="qty-matrix">' +
        '<div class="qty-matrix__head">' +
          '<span>Quantity by size</span>' +
          '<span class="text-muted-xo" style="text-transform:none;letter-spacing:0;font-weight:500">' +
            'Type any number — no clicking one at a time</span>' +
        '</div>' +
        '<div class="qty-grid">' +
          sizes.map(function (s) {
            var id = 'q_' + XO.slug(product.uid + '-' + s);
            return '<div class="qty-cell" data-size="' + XO.esc(s) + '">' +
              '<label for="' + id + '">' + XO.esc(s) + '</label>' +
              '<input id="' + id + '" type="number" inputmode="numeric" min="0" step="1" ' +
              'value="0" data-size="' + XO.esc(s) + '" aria-label="Quantity for size ' + XO.esc(s) + '">' +
            '</div>';
          }).join('') +
        '</div>' +
      '</div>' +

      '<div class="quickfill mt-3">' +
        '<span>Quick fill:</span>' +
        [10, 25, 50, 100].map(function (n) {
          return '<button type="button" data-fill="' + n + '">' + n + ' per size</button>';
        }).join('') +
        '<button type="button" data-fill="clear"><i class="fa-solid fa-rotate-left"></i> Clear</button>' +
      '</div>' +

      '<div class="order-panel mt-3">' +
        '<div class="order-panel__row"><span>Unit price</span><b class="num" data-role="unit">' + XO.money(product.price) + '</b></div>' +
        '<div class="order-panel__row"><span>Total pieces</span><b class="num" data-role="units">0</b></div>' +
        '<div class="order-panel__row" data-role="saveRow" hidden><span>Volume discount</span>' +
          '<b class="num" style="color:var(--xo-success)" data-role="save">-' + XO.money(0) + '</b></div>' +
        '<div class="order-panel__row order-panel__total"><span>Line total <small class="text-muted-xo">(ex VAT)</small></span>' +
          '<b class="num" data-role="total">' + XO.money(0) + '</b></div>' +
        '<p class="form-text mt-2 mb-0" data-role="hint"></p>' +
      '</div>';

    var els = {
      inputs: XO.els('input[data-size]', mount),
      unit: XO.el('[data-role=unit]', mount),
      units: XO.el('[data-role=units]', mount),
      total: XO.el('[data-role=total]', mount),
      save: XO.el('[data-role=save]', mount),
      saveRow: XO.el('[data-role=saveRow]', mount),
      hint: XO.el('[data-role=hint]', mount)
    };

    function totalUnits() {
      return Object.keys(state).reduce(function (n, s) { return n + state[s]; }, 0);
    }

    function refresh() {
      var q = totalUnits();
      var unit = Pricing.unitPrice(product.price, q);
      var line = Pricing.lineTotal(product.price, q);
      var saved = Math.round((product.price * q - line) * 100) / 100;

      els.unit.textContent = XO.money(unit);
      els.units.textContent = q;
      els.total.textContent = XO.money(line);
      els.saveRow.hidden = saved <= 0;
      if (saved > 0) els.save.textContent = '-' + XO.money(saved);

      if (q === 0) {
        els.hint.innerHTML = '<i class="fa-solid fa-circle-info"></i> Enter how many you need of each size.';
      } else if (q < CFG.MOQ) {
        els.hint.innerHTML = '<span style="color:var(--xo-danger)"><i class="fa-solid fa-triangle-exclamation"></i> ' +
          'Minimum order is ' + CFG.MOQ + ' pieces — add ' + (CFG.MOQ - q) + ' more.</span>';
      } else {
        els.hint.innerHTML = '<span style="color:var(--xo-success)"><i class="fa-solid fa-circle-check"></i> ' +
          'Ready to add. Delivery in Dubai within 2–3 working days.</span>';
      }

      XO.els('.qty-cell', mount).forEach(function (c) {
        c.classList.toggle('is-filled', state[c.getAttribute('data-size')] > 0);
      });

      if (typeof opts.onChange === 'function') opts.onChange({ qty: state, units: q, total: line, valid: q >= CFG.MOQ });
    }

    els.inputs.forEach(function (inp) {
      inp.addEventListener('input', function () {
        state[inp.getAttribute('data-size')] = XO.int(inp.value);
        refresh();
      });
      inp.addEventListener('focus', function () { if (inp.value === '0') inp.select(); });
      inp.addEventListener('blur', function () { inp.value = state[inp.getAttribute('data-size')] || 0; });
    });

    XO.els('[data-fill]', mount).forEach(function (btn) {
      btn.addEventListener('click', function () {
        var v = btn.getAttribute('data-fill');
        els.inputs.forEach(function (inp) {
          var n = v === 'clear' ? 0 : parseInt(v, 10);
          inp.value = n;
          state[inp.getAttribute('data-size')] = n;
        });
        refresh();
      });
    });

    refresh();

    return {
      qty: function () { return state; },
      units: totalUnits,
      reset: function () {
        els.inputs.forEach(function (i) { i.value = 0; state[i.getAttribute('data-size')] = 0; });
        refresh();
      }
    };
  };

  /* =======================================================================
     Boot
     ======================================================================= */
  document.addEventListener('DOMContentLoaded', function () {
    renderHeader(document.body.getAttribute('data-page') || '');
    renderFooter();
    renderWhatsAppFab();
    syncCartBadge();
  });

  document.addEventListener('cart:change', syncCartBadge);

})();
