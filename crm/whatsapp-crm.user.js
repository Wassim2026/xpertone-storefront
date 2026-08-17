// ==UserScript==
// @name         XpertOne — log WhatsApp inquiries to the CRM
// @namespace    https://xpertone-crm.vercel.app/
// @version      1.1.0
// @description  Adds a "Log to CRM" button to WhatsApp Web so an inquiry is never lost. Logs new numbers automatically as you open the chat.
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
   How this works
   -------------------------------------------------------------------------
   WhatsApp Web is not built to be automated, so nothing here is guaranteed
   to survive a WhatsApp redesign. It reads the open chat off the page, then
   calls the CRM. It never sends a message, never replies, never opens a chat
   and never marks anything read. It only reads what is already on screen.

   It logs a chat only when the chat title IS a phone number, which on
   WhatsApp means the number is not in your contacts - in other words, a new
   lead. Saved contacts and groups are deliberately skipped: they are people
   you already know, and WhatsApp Web no longer exposes their number to the
   page at all.

   Whether a chat becomes a NEW inquiry is decided by the database, not here:
   a number with an inquiry already open is never logged twice.
   ------------------------------------------------------------------------- */

(function () {
  'use strict';

  var CONFIG_URL = 'https://xpertone-crm.vercel.app/assets/js/config.js';
  var CRM_URL    = 'https://xpertone-crm.vercel.app/crm/';
  var AUTO_KEY   = 'xo_wa_auto';

  var CFG = null;
  var handled = {};
  var currentChat = null;
  var busy = false;

  /* ---------------- config ---------------------------------------------- */

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
            if (!s || !s.url || !s.key) throw new Error('config has no SUPABASE block');
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

  /* ---------------- reading the open chat -------------------------------
     Verified against WhatsApp Business Web, August 2026. The older markup
     (data-id carrying the chat jid, .message-in) is gone, so both the new
     and the old hooks are tried.                                         */

  function chatTitle(main) {
    var el = main.querySelector('[data-testid="conversation-info-header-chat-title"]');
    if (!el) {
      // older builds: first titled span in the header
      var hdr = main.querySelector('header');
      el = hdr ? hdr.querySelector('span[dir="auto"], span[title]') : null;
    }
    if (!el) return '';
    return (el.getAttribute('title') || el.textContent || '').trim();
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

    var titleDigits = title.replace(/[^0-9]/g, '');
    var titleIsPhone = /^\+?[0-9\s\-()]{7,}$/.test(title) && titleDigits.length >= 8;

    var msgs = messageNodes(main);
    var senderPhone = '';
    var texts = [];
    var inbound = 0;

    msgs.forEach(function (m) {
      var labelled = m.querySelector('[aria-label]');
      var al = labelled ? (labelled.getAttribute('aria-label') || '') : '';
      var pm = al.match(/^\+?([0-9][0-9\s\-()]{6,}):/);
      var isOut = /^you:/i.test(al.trim()) ||
                  !!m.querySelector('[data-testid="tail-out"]') ||
                  (m.className || '').indexOf('message-out') !== -1;
      var isIn = !isOut && (!!m.querySelector('[data-testid="tail-in"]') || !!pm ||
                            (m.className || '').indexOf('message-in') !== -1);

      if (pm && !senderPhone) senderPhone = pm[1].replace(/[^0-9]/g, '');

      if (isIn) {
        inbound++;
        var t = m.querySelector('.selectable-text');
        var txt = t ? (t.innerText || t.textContent || '').trim() : '';
        if (txt) texts.push(txt);
      }
    });

    var phone = titleIsPhone ? titleDigits : senderPhone;

    return {
      key: title,
      title: title,
      phone: phone,
      name: titleIsPhone ? '' : title,
      titleIsPhone: titleIsPhone,
      loggable: !!(phone && phone.length >= 8),
      inbound: inbound,
      texts: texts.slice(-4)
    };
  }

  /* ---------------- the panel -------------------------------------------- */

  var el = {};

  function buildPanel() {
    var wrap = document.createElement('div');
    wrap.id = 'xo-crm-panel';
    wrap.innerHTML = ''
      + '<style>'
      + '#xo-crm-panel{position:fixed;right:18px;bottom:18px;z-index:2147483000;'
      + 'font:13px -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;'
      + 'background:#fff;border:1px solid #e4e4e4;border-radius:12px;width:252px;'
      + 'box-shadow:0 6px 26px rgba(0,0,0,.16);overflow:hidden}'
      + '#xo-crm-panel .hd{background:#111;color:#fff;padding:9px 12px;display:flex;align-items:center;gap:8px}'
      + '#xo-crm-panel .dot{width:20px;height:20px;border-radius:5px;background:#ffc400;color:#000;'
      + 'display:grid;place-items:center;font-weight:800;font-size:11px}'
      + '#xo-crm-panel .hd b{font-size:12.5px;font-weight:600;flex:1}'
      + '#xo-crm-panel .bd{padding:11px 12px}'
      + '#xo-crm-panel .who{font-size:12px;color:#555;margin-bottom:9px;line-height:1.35;'
      + 'white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
      + '#xo-crm-panel .who b{color:#111}'
      + '#xo-crm-panel button.go{width:100%;background:#ffc400;border:0;border-radius:8px;'
      + 'padding:9px;font-weight:700;cursor:pointer;font-size:13px}'
      + '#xo-crm-panel button.go:disabled{opacity:.45;cursor:not-allowed}'
      + '#xo-crm-panel .row{display:flex;align-items:center;gap:7px;margin-top:9px;font-size:12px;color:#444}'
      + '#xo-crm-panel .row input{margin:0}'
      + '#xo-crm-panel .msg{margin-top:8px;font-size:11.5px;line-height:1.35;min-height:15px}'
      + '#xo-crm-panel .ok{color:#1b8a4b}#xo-crm-panel .er{color:#c62828}#xo-crm-panel .mu{color:#999}'
      + '#xo-crm-panel a.open{display:block;margin-top:7px;font-size:11.5px;color:#666}'
      + '</style>'
      + '<div class="hd"><span class="dot">X1</span><b>XpertOne CRM</b></div>'
      + '<div class="bd">'
      + '  <div class="who" id="xo-who">Open a chat...</div>'
      + '  <button class="go" id="xo-go" disabled>Log to CRM</button>'
      + '  <label class="row"><input type="checkbox" id="xo-auto"> Log new numbers automatically</label>'
      + '  <div class="msg mu" id="xo-msg"></div>'
      + '  <a class="open" href="' + CRM_URL + '" target="_blank" rel="noopener">Open the CRM &rarr;</a>'
      + '</div>';
    document.body.appendChild(wrap);

    el.who = wrap.querySelector('#xo-who');
    el.go = wrap.querySelector('#xo-go');
    el.auto = wrap.querySelector('#xo-auto');
    el.msg = wrap.querySelector('#xo-msg');

    try { el.auto.checked = localStorage.getItem(AUTO_KEY) !== '0'; }
    catch (e) { el.auto.checked = true; }

    el.auto.addEventListener('change', function () {
      try { localStorage.setItem(AUTO_KEY, el.auto.checked ? '1' : '0'); } catch (e) {}
      say(el.auto.checked ? 'New numbers will be logged as you open them.' : 'Automatic logging is off.', 'mu');
      if (el.auto.checked) maybeAuto();
    });

    el.go.addEventListener('click', function () { logChat(); });
  }

  function say(text, kind) {
    if (!el.msg) return;
    el.msg.className = 'msg ' + (kind || 'mu');
    el.msg.textContent = text;
  }

  /* ---------------- logging ---------------------------------------------- */

  function logChat() {
    var c = currentChat;
    if (!c || busy || !c.loggable) return;

    busy = true;
    el.go.disabled = true;
    say('Saving...', 'mu');

    var first = c.texts.length ? c.texts[0] : '';
    var body = {
      p_phone: c.phone,
      p_name: c.name,
      p_product: first.slice(0, 120),
      p_notes: c.texts.join(' | ').slice(0, 1800)
    };

    rpc('log_whatsapp_inquiry', body).then(function (res) {
      handled[c.key] = true;
      if (res && res.created) say('Logged as inquiry #' + res.ref + '.', 'ok');
      else if (res) say('Already open as #' + res.ref + ' - not duplicated.', 'mu');
      else say('Saved.', 'ok');
    })['catch'](function (e) {
      say(e.message || 'Could not save.', 'er');
    })['finally'](function () {
      busy = false;
      el.go.disabled = !(currentChat && currentChat.loggable);
    });
  }

  function maybeAuto() {
    if (!el.auto || !el.auto.checked) return;
    var c = currentChat;
    if (!c || !c.loggable || handled[c.key] || c.inbound === 0) return;
    logChat();
  }

  /* ---------------- watch which chat is open ------------------------------ */

  function tick() {
    var c = readOpenChat();

    if (!c) {
      currentChat = null;
      if (el.who) el.who.textContent = 'Open a chat...';
      if (el.go) el.go.disabled = true;
      return;
    }

    var changed = !currentChat || currentChat.key !== c.key;
    currentChat = c;
    if (el.go) el.go.disabled = !c.loggable;

    if (el.who) {
      el.who.innerHTML = c.loggable
        ? '<b>New number</b><br>+' + c.phone
        : '<b>' + (c.name || 'This chat') + '</b><br>saved contact or group';
    }

    if (changed) {
      say(c.loggable ? '' : 'Already in your contacts, so not a new lead.', 'mu');
      setTimeout(function () {
        var fresh = readOpenChat();
        if (fresh && currentChat && fresh.key === currentChat.key) {
          currentChat = fresh;
          if (el.go) el.go.disabled = !fresh.loggable;
          maybeAuto();
        }
      }, 1500);
    }
  }

  /* ---------------- start -------------------------------------------------- */

  function start() {
    buildPanel();
    say('Connecting to the CRM...', 'mu');

    loadConfig().then(function (cfg) {
      CFG = cfg;
      say('Ready.', 'ok');
      setInterval(tick, 1200);
      tick();
    })['catch'](function (e) {
      say('Cannot reach the CRM: ' + (e.message || e), 'er');
    });
  }

  var waited = 0;
  var boot = setInterval(function () {
    waited += 500;
    if (document.querySelector('#pane-side') || waited > 60000) {
      clearInterval(boot);
      if (!document.getElementById('xo-crm-panel')) start();
    }
  }, 500);
})();
// ==UserScript==
// @name         XpertOne — log WhatsApp inquiries to the CRM
// @namespace    https://xpertone-crm.vercel.app/
// @version      1.0.0
// @description  Adds a "Log to CRM" button to WhatsApp Web so an inquiry is never lost. Can log every new number automatically as you open the chat.
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
   How this works
   -------------------------------------------------------------------------
   WhatsApp Web is not built to be automated, so nothing here is guaranteed
   to survive a WhatsApp redesign. It reads the open chat off the page, then
   calls the CRM. It never sends a message, never replies, never opens or
   marks chats. It only reads what is already on your screen.

   Whether a chat becomes a NEW inquiry is decided by the database, not here:
   a number with an inquiry already open is never logged twice.
   ------------------------------------------------------------------------- */

(function () {
  'use strict';

  var CONFIG_URL = 'https://xpertone-crm.vercel.app/assets/js/config.js';
  var CRM_URL    = 'https://xpertone-crm.vercel.app/crm/';
  var AUTO_KEY   = 'xo_wa_auto';

  var CFG = null;              // { url, key } pulled from the CRM at startup
  var handled = {};            // chat jids dealt with in this browser session
  var currentChat = null;
  var busy = false;

  /* ---------------- config ------------------------------------------------
     The Supabase key lives in one place — the CRM's own config.js — so this
     script never carries a copy that could drift out of date.             */

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
            if (!s || !s.url || !s.key) throw new Error('config has no SUPABASE block');
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

  /* ---------------- reading the open chat ------------------------------- */

  function looksLikeNumber(s) {
    return /^[+\d][\d\s\-()]{5,}$/.test(String(s || '').trim());
  }

  // Message rows carry data-id="<fromMe>_<chatJid>_<messageId>".
  function readOpenChat() {
    var main = document.querySelector('#main');
    if (!main) return null;

    var jid = null;
    var rows = main.querySelectorAll('[data-id]');
    for (var i = 0; i < rows.length; i++) {
      var parts = String(rows[i].getAttribute('data-id') || '').split('_');
      if (parts.length >= 2 && parts[1].indexOf('@') !== -1) { jid = parts[1]; break; }
    }

    var titleEl = main.querySelector('header span[title]');
    var title = titleEl ? (titleEl.getAttribute('title') || titleEl.textContent || '').trim() : '';

    // Fall back to the header when it is an unsaved contact (title is the number).
    if (!jid && looksLikeNumber(title)) jid = title.replace(/[^\d]/g, '') + '@c.us';
    if (!jid) return null;

    var isGroup = jid.indexOf('@g.us') !== -1;
    var phone = jid.split('@')[0].split(':')[0];

    // Saved contact -> title is their name. Unsaved -> title is the number.
    var name = (!title || looksLikeNumber(title)) ? '' : title;

    // What they actually said, newest last.
    var texts = [];
    var incoming = main.querySelectorAll('.message-in');
    for (var j = Math.max(0, incoming.length - 6); j < incoming.length; j++) {
      var t = incoming[j].querySelector('.selectable-text');
      var txt = t ? (t.innerText || t.textContent || '').trim() : '';
      if (txt) texts.push(txt);
    }

    return {
      jid: jid,
      phone: phone,
      name: name,
      title: title,
      isGroup: isGroup,
      inbound: incoming.length,
      texts: texts
    };
  }

  /* ---------------- the panel ------------------------------------------- */

  var el = {};

  function buildPanel() {
    var wrap = document.createElement('div');
    wrap.id = 'xo-crm-panel';
    wrap.innerHTML = ''
      + '<style>'
      + '#xo-crm-panel{position:fixed;right:18px;bottom:18px;z-index:2147483000;'
      + 'font:13px -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;'
      + 'background:#fff;border:1px solid #e4e4e4;border-radius:12px;width:250px;'
      + 'box-shadow:0 6px 26px rgba(0,0,0,.16);overflow:hidden}'
      + '#xo-crm-panel .hd{background:#111;color:#fff;padding:9px 12px;display:flex;align-items:center;gap:8px}'
      + '#xo-crm-panel .dot{width:20px;height:20px;border-radius:5px;background:#ffc400;color:#000;'
      + 'display:grid;place-items:center;font-weight:800;font-size:11px}'
      + '#xo-crm-panel .hd b{font-size:12.5px;font-weight:600;flex:1}'
      + '#xo-crm-panel .bd{padding:11px 12px}'
      + '#xo-crm-panel .who{font-size:12px;color:#555;margin-bottom:9px;line-height:1.35;'
      + 'white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
      + '#xo-crm-panel .who b{color:#111}'
      + '#xo-crm-panel button.go{width:100%;background:#ffc400;border:0;border-radius:8px;'
      + 'padding:9px;font-weight:700;cursor:pointer;font-size:13px}'
      + '#xo-crm-panel button.go:disabled{opacity:.5;cursor:not-allowed}'
      + '#xo-crm-panel .row{display:flex;align-items:center;gap:7px;margin-top:9px;font-size:12px;color:#444}'
      + '#xo-crm-panel .row input{margin:0}'
      + '#xo-crm-panel .msg{margin-top:8px;font-size:11.5px;line-height:1.35;min-height:15px}'
      + '#xo-crm-panel .ok{color:#1b8a4b}#xo-crm-panel .er{color:#c62828}#xo-crm-panel .mu{color:#999}'
      + '#xo-crm-panel a.open{display:block;margin-top:7px;font-size:11.5px;color:#666}'
      + '</style>'
      + '<div class="hd"><span class="dot">X1</span><b>XpertOne CRM</b></div>'
      + '<div class="bd">'
      + '  <div class="who" id="xo-who">Open a chat…</div>'
      + '  <button class="go" id="xo-go" disabled>Log to CRM</button>'
      + '  <label class="row"><input type="checkbox" id="xo-auto"> Log new numbers automatically</label>'
      + '  <div class="msg mu" id="xo-msg"></div>'
      + '  <a class="open" href="' + CRM_URL + '" target="_blank" rel="noopener">Open the CRM &rarr;</a>'
      + '</div>';
    document.body.appendChild(wrap);

    el.who = wrap.querySelector('#xo-who');
    el.go = wrap.querySelector('#xo-go');
    el.auto = wrap.querySelector('#xo-auto');
    el.msg = wrap.querySelector('#xo-msg');

    try { el.auto.checked = localStorage.getItem(AUTO_KEY) !== '0'; }
    catch (e) { el.auto.checked = true; }

    el.auto.addEventListener('change', function () {
      try { localStorage.setItem(AUTO_KEY, el.auto.checked ? '1' : '0'); } catch (e) {}
      say(el.auto.checked ? 'New numbers will be logged as you open them.' : 'Automatic logging is off.', 'mu');
      if (el.auto.checked) maybeAuto();
    });

    el.go.addEventListener('click', function () { logChat(true); });
  }

  function say(text, kind) {
    if (!el.msg) return;
    el.msg.className = 'msg ' + (kind || 'mu');
    el.msg.textContent = text;
  }

  /* ---------------- logging --------------------------------------------- */

  function logChat(manual) {
    var c = currentChat;
    if (!c || busy) return;

    if (c.isGroup) { say('That is a group chat — not logged.', 'mu'); return; }
    if (!manual && c.inbound === 0) return;   // never messaged us; nothing to log

    busy = true;
    el.go.disabled = true;
    say('Saving…', 'mu');

    var first = c.texts.length ? c.texts[0] : '';
    var body = {
      p_phone: c.phone,
      p_name: c.name,
      p_product: first.slice(0, 120),
      p_notes: c.texts.slice(-4).join('\n').slice(0, 1800)
    };

    rpc('log_whatsapp_inquiry', body).then(function (res) {
      handled[c.jid] = true;
      if (res && res.created) {
        say('Logged as inquiry #' + res.ref + '.', 'ok');
      } else if (res) {
        say('Already open as #' + res.ref + ' — not duplicated.', 'mu');
      } else {
        say('Saved.', 'ok');
      }
    })['catch'](function (e) {
      say(e.message || 'Could not save.', 'er');
    })['finally'](function () {
      busy = false;
      el.go.disabled = !currentChat;
    });
  }

  function maybeAuto() {
    if (!el.auto || !el.auto.checked) return;
    var c = currentChat;
    if (!c || c.isGroup || handled[c.jid] || c.inbound === 0) return;
    logChat(false);
  }

  /* ---------------- watch which chat is open ----------------------------- */

  function tick() {
    var c = readOpenChat();

    if (!c) {
      currentChat = null;
      if (el.who) el.who.textContent = 'Open a chat…';
      if (el.go) el.go.disabled = true;
      return;
    }

    var changed = !currentChat || currentChat.jid !== c.jid;
    currentChat = c;
    if (el.go) el.go.disabled = false;

    if (el.who) {
      el.who.innerHTML = c.isGroup
        ? '<b>Group chat</b><br>groups are not logged'
        : '<b>' + (c.name || 'Unsaved contact') + '</b><br>+' + c.phone;
    }

    if (changed) {
      if (!c.isGroup) say('', 'mu');
      // let the messages finish rendering before reading them
      setTimeout(function () {
        var fresh = readOpenChat();
        if (fresh && currentChat && fresh.jid === currentChat.jid) {
          currentChat = fresh;
          maybeAuto();
        }
      }, 1400);
    }
  }

  /* ---------------- start ------------------------------------------------ */

  function start() {
    buildPanel();
    say('Connecting to the CRM…', 'mu');

    loadConfig().then(function (cfg) {
      CFG = cfg;
      say('Ready.', 'ok');
      setInterval(tick, 1200);
      tick();
    })['catch'](function (e) {
      say('Cannot reach the CRM: ' + (e.message || e), 'er');
    });
  }

  // WhatsApp Web boots slowly; wait for its main frame before adding anything.
  var waited = 0;
  var boot = setInterval(function () {
    waited += 500;
    if (document.querySelector('#pane-side') || waited > 60000) {
      clearInterval(boot);
      if (!document.getElementById('xo-crm-panel')) start();
    }
  }, 500);
})();
