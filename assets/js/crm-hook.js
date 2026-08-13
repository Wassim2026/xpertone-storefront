/* =========================================================================
   XpertOne — storefront to CRM bridge
   -------------------------------------------------------------------------
   Mirrors every quote request placed on the storefront into the CRM inquiry
   log, so a website lead is captured the same way a WhatsApp lead is.

   Deliberately additive: it never blocks, never validates, and never throws
   into the checkout flow. If the CRM is unreachable the order still goes
   through by email and WhatsApp exactly as before.
   ========================================================================= */
(function () {
  'use strict';

  var C = (window.XO_CONFIG && window.XO_CONFIG.SUPABASE) || {};
  if (!C.url || !C.key) return;

  function val(id) {
    var el = document.getElementById(id);
    return el && el.value ? String(el.value).trim() : '';
  }

  /* What they are asking for, read from the cart if it is available. */
  function basket() {
    try {
      if (window.Cart && typeof window.Cart.lines === 'function') {
        var lines = window.Cart.lines() || [];
        var names = [];
        var total = 0;

        lines.forEach(function (l) {
          names.push(l.title || l.name || l.sku || 'item');
          if (l.qty && typeof l.qty === 'object') {
            Object.keys(l.qty).forEach(function (s) { total += Number(l.qty[s]) || 0; });
          } else {
            total += Number(l.qty) || 0;
          }
        });

        if (names.length) {
          return { text: names.join(', ').slice(0, 300), qty: total || null };
        }
      }
    } catch (e) { /* cart shape changed — fall through to the generic label */ }
    return { text: 'Website order', qty: null };
  }

  var sent = false;

  function logInquiry() {
    if (sent) return;

    var phone = val('f_phone');
    var email = val('f_email');
    if (!phone && !email) return;   // nothing to reach them on; let validation handle it

    sent = true;
    var b = basket();

    fetch(C.url + '/rest/v1/rpc/log_inquiry', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': C.key,
        'Authorization': 'Bearer ' + C.key
      },
      body: JSON.stringify({
        p_company: val('f_company'),
        p_contact: val('f_name'),
        p_phone: phone,
        p_email: email,
        p_product: b.text,
        p_qty: b.qty,
        p_source: 'website',
        p_notes: [val('f_emirate'), val('f_area'), val('f_notes')]
          .filter(Boolean).join(' | ').slice(0, 2000)
      }),
      keepalive: true
    })['catch'](function () {
      sent = false;   // let a retry through if the network dropped
    });
  }

  /* Delegated from the document, because checkout builds its form only once
     the cart has something in it — binding to #coForm directly would miss it.
     Capture phase runs before the page's own handler, which navigates away
     and clears the cart. */
  document.addEventListener('submit', function (e) {
    var t = e.target;
    if (t && t.id === 'coForm') logInquiry();
  }, true);

  document.addEventListener('click', function (e) {
    var t = e.target;
    if (t && t.closest && t.closest('#waSend')) logInquiry();
  }, true);
})();
/* =========================================================================
   XpertOne — storefront to CRM bridge
   -------------------------------------------------------------------------
   Mirrors every quote request placed on the storefront into the CRM inquiry
   log, so a website lead is captured the same way a WhatsApp lead is.

   Deliberately additive: it never blocks, never validates, and never throws
   into the checkout flow. If the CRM is unreachable the order still goes
   through by email and WhatsApp exactly as before.
   ========================================================================= */
(function () {
  'use strict';

  var C = (window.XO_CONFIG && window.XO_CONFIG.SUPABASE) || {};
  if (!C.url || !C.key) return;

  function val(id) {
    var el = document.getElementById(id);
    return el && el.value ? String(el.value).trim() : '';
  }

  /* What they are asking for, read from the cart if it is available. */
  function basket() {
    try {
      if (window.Cart && typeof window.Cart.lines === 'function') {
        var lines = window.Cart.lines() || [];
        var names = [];
        var total = 0;

        lines.forEach(function (l) {
          names.push(l.title || l.name || l.sku || 'item');
          if (l.qty && typeof l.qty === 'object') {
            Object.keys(l.qty).forEach(function (s) { total += Number(l.qty[s]) || 0; });
          } else {
            total += Number(l.qty) || 0;
          }
        });

        if (names.length) {
          return { text: names.join(', ').slice(0, 300), qty: total || null };
        }
      }
    } catch (e) { /* cart shape changed — fall through to the generic label */ }
    return { text: 'Website order', qty: null };
  }

  var sent = false;

  function logInquiry() {
    if (sent) return;

    var phone = val('f_phone');
    var email = val('f_email');
    if (!phone && !email) return;   // nothing to reach them on; let validation handle it

    sent = true;
    var b = basket();

    fetch(C.url + '/rest/v1/rpc/log_inquiry', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': C.key,
        'Authorization': 'Bearer ' + C.key
      },
      body: JSON.stringify({
        p_company: val('f_company'),
        p_contact: val('f_name'),
        p_phone: phone,
        p_email: email,
        p_product: b.text,
        p_qty: b.qty,
        p_source: 'website',
        p_notes: [val('f_emirate'), val('f_area'), val('f_notes')]
          .filter(Boolean).join(' | ').slice(0, 2000)
      }),
      keepalive: true
    })['catch'](function () {
      sent = false;   // let a retry through if the network dropped
    });
  }

  function wire() {
    var form = document.getElementById('coForm');
    // Capture phase: runs before the page's own submit handler, which may
    // navigate away or clear the cart.
    if (form) form.addEventListener('submit', logInquiry, true);

    var wa = document.getElementById('waSend');
    if (wa) wa.addEventListener('click', logInquiry, true);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wire);
  } else {
    wire();
  }
})();
