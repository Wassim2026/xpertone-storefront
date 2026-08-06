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
  function navLinks(active) {
    var items = [
      { href: 'index.html', label: 'Home', key: 'home' },
      { href: 'shop.html', label: 'Shop All', key: 'shop' }
    ];
    /* Only the flagged ranges go in the bar — twelve links would not fit.
       The rest are one click away under Shop All. */
    CFG.CATEGORIES.filter(function (c) { return c.nav; }).forEach(function (c) {
      items.push({ href: 'shop.html?category=' + c.slug, label: c.name, key: c.slug });
    });
    items.push({ href: 'about.html', label: 'About', key: 'about' });
    items.push({ href: 'contact.html', label: 'Contact', key: 'contact' });

    return items.map(function (i) {
      return '<a href="' + i.href + '"' + (i.key === active ? ' class="is-active" aria-current="page"' : '') + '>' +
             XO.esc(i.label) + '</a>';
    }).join('');
  }

  function renderHeader(active) {
    var mount = document.getElementById('siteHeader');
    if (!mount) return;

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

        '<nav class="mainnav d-none d-xl-flex" aria-label="Main">' + navLinks(active) + '</nav>' +

        '<div class="header-actions ms-auto ms-xl-0">' +
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

      '<div class="offcanvas offcanvas-end" tabindex="-1" id="mobileNav" aria-label="Menu">' +
        '<div class="offcanvas-header border-bottom">' +
          '<span class="brand"><span class="brand__mark">X1</span>' +
          '<span><span class="brand__name">XpertOne</span><span class="brand__tag">Prints &amp; Safety</span></span></span>' +
          '<button type="button" class="btn-close" data-bs-dismiss="offcanvas" aria-label="Close"></button>' +
        '</div>' +
        '<div class="offcanvas-body">' +
          '<nav class="d-flex flex-column gap-1 mainnav align-items-stretch">' + navLinks(active) + '</nav>' +
          '<hr>' +
          '<a class="btn btn-wa w-100" href="' + XO.waLink('Hello XpertOne, I would like a quote.') + '" target="_blank" rel="noopener">' +
            '<i class="fa-brands fa-whatsapp"></i> Order on WhatsApp</a>' +
        '</div>' +
      '</div>';
  }

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
            '<span class="product-card__cat">' + XO.esc(p.categoryName) + '</span>' +
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
