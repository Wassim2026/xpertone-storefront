// ==UserScript==
// @name         XpertOne — add WhatsApp chat to CRM
// @namespace    https://xpertone-crm.vercel.app/
// @version      2.0.0
// @description  One button on WhatsApp Web. Open a chat, click it, the lead is in the CRM.
// @author       XpertOne Prints
// @match        https://web.whatsapp.com/*
// @grant        GM_xmlhttpRequest
// @connect      xpertone-crm.vercel.app
// @connect      supabase.co
// @run-at       document-idle
// @updateURL    https://xpertone-crm.vercel.app/crm/whatsapp-crm.user.js
// @downloadURL  https://xpertone-crm.vercel.app/crm/whatsapp-crm.user.js
// ==/UserScript==

/* -------------------------------------------------------------------------
   Open a chat, click "Add to CRM". That is the whole thing.

   It only reads what is already on your screen. It never sends a message,
   never opens a chat, never marks anything read.

   Clicking the same chat twice does not create a second inquiry - the
   database returns the one that is already open.
   ------------------------------------------------------------------------- */

(function () {
  'use strict';

  var CONFIG_URL = 'https://xpertone-crm.vercel.app/assets/js/config.js';
  var CFG = null;
  var busy = false;

  /* ---------------- talking to the CRM ---------------------------------- */

  /* WhatsApp Web's content security policy blocks every outbound request
     made from the page itself - verified, both the CRM and Supabase are
     refused. GM_xmlhttpRequest runs in Tampermonkey's own context, outside
     that policy, which is why it is used here instead of fetch.

     The Supabase url and public key live in one place - the CRM's own
     config.js - so this script never carries a copy that can go stale. */

  function loadConfig() {
    return new Promise(function (resolve, reject) {
      GM_xmlhttpRequest({
        method: 'GET',
        url: CONFIG_URL + '?t=' + Date.now(),
        onload: function (r) {
          try {
            var shim = {};
            new Function('window', r.responseText)(shim);
            var s = shim.XO_CONFIG && shim.XO_CONFIG.SUPABASE;
            if (!s || !s.url || !s.key) throw new Error('no SUPABASE block in config');
            resolve(s);
          } catch (e) { reject(e); }
        },
        onerror: function () { reject(new Error('could not reach the CRM')); }
      });
    });
  }

  function rpc(name, body) {
    return new Promise(function (resolve, reject) {
      GM_xmlhttpRequest({
        method: 'POST',
        url: CFG.url + '/rest/v1/rpc/' + name,
        headers: {
          'Content-Type': 'application/json',
          'apikey': CFG.key,
          'Authorization': 'Bearer ' + CFG.key
        },
        data: JSON.stringify(body),
        onload: function (r) {
          if (r.status >= 200 && r.status < 300) {
            try { resolve(JSON.parse(r.responseText || 'null')); }
            catch (e) { resolve(null); }
          } else {
            var msg = r.responseText || ('HTTP ' + r.status);
            try { msg = JSON.parse(r.responseText).message || msg; } catch (e) {}
            reject(new Error(msg));
          }
        },
        onerror: function () { reject(new Error('no connection')); }
      });
    });
  }

  /* ---------------- reading the open chat --------------------------------
     Verified against WhatsApp Business Web, August 2026. Older builds put
     the number in data-id and marked messages .message-in; both are gone,
     so the new hooks are tried first and the old ones kept as a fallback. */

  function chatTitle(main) {
    var t = main.querySelector('[data-testid="conversation-info-header-chat-title"]');
    if (!t) {
      var hdr = main.querySelector('header');
      t = hdr ? hdr.querySelector('span[dir="auto"], span[title]') : null;
    }
    return t ? (t.getAttribute('title') || t.textContent || '').trim() : '';
  }

  function messageNodes(main) {
    var list = main.querySelectorAll('[data-testid^="conv-msg-"]');
    if (list.length) return [].slice.call(list);
    return [].slice.call(main.querySelectorAll('.message-in, .message-out'));
  }

  function readOpenChat() {
    var main = document.querySelector('#main');
    if (!main) return null;

    var title = chatTitle(main);
    if (!title) return null;

    var digits = title.replace(/[^0-9]/g, '');
    var titleIsPhone = /^\+?[0-9\s\-()]{7,}$/.test(title) && digits.length >= 8;

    var senderPhone = '';
    var texts = [];

    messageNodes(main).forEach(function (m) {
      var labelled = m.querySelector('[aria-label]');
      var al = labelled ? (labelled.getAttribute('aria-label') || '') : '';
      var pm = al.match(/^\+?([0-9][0-9\s\-()]{6,}):/);
      var isOut = /^you:/i.test(al.trim()) ||
                  !!m.querySelector('[data-testid="tail-out"]') ||
                  (m.className || '').indexOf('message-out') !== -1;

      if (pm && !senderPhone) senderPhone = pm[1].replace(/[^0-9]/g, '');

      if (!isOut) {
        var t = m.querySelector('.selectable-text');
        var txt = t ? (t.innerText || t.textContent || '').trim() : '';
        if (txt) texts.push(txt);
      }
    });

    return {
      phone: titleIsPhone ? digits : senderPhone,
      name: titleIsPhone ? '' : title,
      label: title,
      texts: texts.slice(-4)
    };
  }

  /* ---------------- the button -------------------------------------------- */

  var btn, note;

  function build() {
    var wrap = document.createElement('div');
    wrap.id = 'xo-crm-btn';
    wrap.innerHTML = ''
      + '<style>'
      + '#xo-crm-btn{position:fixed;right:20px;bottom:20px;z-index:2147483000;'
      + 'font:13px -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;text-align:right}'
      + '#xo-crm-btn button{background:#ffc400;color:#111;border:0;border-radius:22px;'
      + 'padding:11px 18px;font-weight:700;font-size:13.5px;cursor:pointer;'
      + 'box-shadow:0 4px 16px rgba(0,0,0,.22)}'
      + '#xo-crm-btn button:hover{filter:brightness(.95)}'
      + '#xo-crm-btn button:disabled{opacity:.4;cursor:not-allowed}'
      + '#xo-crm-btn .n{margin-top:6px;font-size:11.5px;background:#111;color:#fff;'
      + 'padding:4px 9px;border-radius:6px;display:none;max-width:230px}'
      + '#xo-crm-btn .n.on{display:inline-block}'
      + '</style>'
      + '<button id="xo-add">+ Add to CRM</button>'
      + '<div class="n" id="xo-note"></div>';
    document.body.appendChild(wrap);

    btn = wrap.querySelector('#xo-add');
    note = wrap.querySelector('#xo-note');
    btn.addEventListener('click', add);

    setInterval(function () {
      if (!busy) btn.disabled = !document.querySelector('#main');
    }, 1000);
  }

  function tell(text, ms) {
    note.textContent = text;
    note.className = 'n on';
    clearTimeout(tell._t);
    tell._t = setTimeout(function () { note.className = 'n'; }, ms || 4000);
  }

  function add() {
    if (busy) return;
    var c = readOpenChat();
    if (!c) { tell('Open a chat first.'); return; }
    if (!c.phone && !c.name) { tell('Could not read this chat.'); return; }

    busy = true;
    btn.disabled = true;
    btn.textContent = 'Adding...';

    rpc('log_whatsapp_inquiry', {
      p_phone: c.phone,
      p_name: c.name,
      p_product: (c.texts[0] || '').slice(0, 120),
      p_notes: c.texts.join(' | ').slice(0, 1800)
    }).then(function (res) {
      if (res && res.created) tell('Added as inquiry #' + res.ref);
      else if (res) tell('Already in the CRM as #' + res.ref);
      else tell('Added.');
    })['catch'](function (e) {
      tell(e.message || 'Could not add it.', 6000);
    })['finally'](function () {
      busy = false;
      btn.textContent = '+ Add to CRM';
      btn.disabled = !document.querySelector('#main');
    });
  }

  /* ---------------- start -------------------------------------------------- */

  var waited = 0;
  var boot = setInterval(function () {
    waited += 500;
    if (document.querySelector('#pane-side') || waited > 60000) {
      clearInterval(boot);
      if (document.getElementById('xo-crm-btn')) return;
      build();
      btn.disabled = true;
      loadConfig().then(function (cfg) {
        CFG = cfg;
        btn.disabled = !document.querySelector('#main');
      })['catch'](function (e) {
        tell('Cannot reach the CRM: ' + (e.message || e), 8000);
      });
    }
  }, 500);
})();
