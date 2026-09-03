/* =========================================================================
   Xpertone Creative LLC-FZ — brandkit.js
   -------------------------------------------------------------------------
   An internal tool for the sales team, not for customers.

   Enter a client once — company name, contact number, logo — and the whole
   catalogue is branded with it. Tick the items worth sending, and download
   them as one folder of images or as a PDF catalogue.

   Client records are held in this browser (localStorage) and can be exported
   to a file, so they survive a new machine and can be loaded into the
   backend once accounts exist server-side.
   ========================================================================= */

(function () {
  'use strict';

  var CFG = window.XO_CONFIG;
  var BK = CFG.BRAND_KIT || {};
  var KEY = BK.clientsKey || 'xo_clients_v1';
  var E = window.XODesign;

  /* =======================================================================
     Client records
     ======================================================================= */
  var Clients = window.Clients = {

    all: function () {
      try {
        var v = JSON.parse(localStorage.getItem(KEY) || '[]');
        return Array.isArray(v) ? v : [];
      } catch (e) { return []; }
    },

    get: function (id) {
      var hit = null;
      this.all().forEach(function (c) { if (c.id === id) hit = c; });
      return hit;
    },

    /* Returns { ok:true } or { ok:false, reason:'full' } so the caller can
       tell the difference between saved and silently lost. */
    save: function (rec) {
      var list = this.all();
      var i = -1;
      list.forEach(function (c, k) { if (c.id === rec.id) i = k; });
      rec.updated = new Date().toISOString();
      if (i > -1) list[i] = rec; else { rec.created = rec.updated; list.unshift(rec); }

      if (this._write(list)) return { ok: true };

      /* Out of room. Drop the logos of the least recently touched records —
         the details matter more than the picture, and everything can be
         re-uploaded. */
      var byAge = list.slice().sort(function (a, b) {
        return String(a.updated).localeCompare(String(b.updated));
      });
      for (var n = 0; n < byAge.length; n++) {
        if (byAge[n].id === rec.id || !byAge[n].logo) continue;
        delete byAge[n].logo;
        if (this._write(list)) return { ok: true, reason: 'trimmed' };
      }
      return { ok: false, reason: 'full' };
    },

    _write: function (list) {
      try { localStorage.setItem(KEY, JSON.stringify(list)); return true; }
      catch (e) { return false; }
    },

    remove: function (id) {
      this._write(this.all().filter(function (c) { return c.id !== id; }));
    },

    /* Roughly how much of the browser's allowance this is using. */
    usage: function () {
      var b = 0;
      try { b = (localStorage.getItem(KEY) || '').length; } catch (e) {}
      return { bytes: b, pct: Math.min(100, Math.round(b / (5 * 1024 * 1024) * 100)) };
    }
  };

  /* =======================================================================
     Helpers
     ======================================================================= */

  function newId() {
    return 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function safeName(s) {
    return String(s || 'client').replace(/[^A-Za-z0-9 _\-]+/g, '').replace(/\s+/g, ' ').trim() || 'client';
  }

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  function today() {
    var d = new Date();
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  function fmtBytes(n) {
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return Math.round(n / 1024) + ' KB';
    return (n / 1024 / 1024).toFixed(1) + ' MB';
  }

  /* =======================================================================
     State
     ======================================================================= */

  var S = {
    id: null,
    company: '', companyAr: '', phone: '', contact: '', notes: '',
    colour: (CFG.PRINTING.inkColours[0] || {}).hex || '#FFFFFF',
    sleeves: false,
    cut: true,
    tolerance: CFG.PRINTING.bgTolerance || 46,
    target: 900,
    sharpAmount: Math.round((CFG.PRINTING.sharpenAmount || 0.45) * 100),
    logo: '', logoName: '', logoPx: 0, removedBg: false,
    logo2: '', logo2Name: '',
    twoLogos: false, backLogo2: false,
    autoInk: true,
    picks: {},
    dirty: false
  };

  var products = [];
  var logoImg = null;
  var logoImg2 = null;
  var results = [];       // { uid, title, price, category, png, jpeg, w, h, url, on }
  var running = false;
  var cancelled = false;

  /* =======================================================================
     Markup
     ======================================================================= */

  function shell() {
    var swatches = (CFG.PRINTING.inkColours || []).map(function (c, i) {
      return '<button type="button" class="swatch' + (i === 0 ? ' is-active' : '') + '" ' +
        'data-hex="' + c.hex + '" style="--sw:' + c.hex + '" ' +
        'title="' + XO.esc(c.name) + '" aria-label="' + XO.esc(c.name) + '"></button>';
    }).join('');

    return '' +
    '<div class="bk">' +

      /* ------------------------------ clients ------------------------- */
      '<aside class="bk__side">' +
        '<div class="bk__sidehead">' +
          '<h2 class="h6 mb-0">Clients</h2>' +
          '<button class="btn btn-xo btn-sm" id="bkNew" type="button">' +
            '<i class="fa-solid fa-plus"></i> New</button>' +
        '</div>' +
        '<input class="form-control form-control-sm mb-2" id="bkSearch" type="search" ' +
          'placeholder="Search company or number">' +
        '<div id="bkList" class="bk__list"></div>' +
        '<div class="bk__storage" id="bkStorage"></div>' +
        '<button class="btn btn-xo btn-sm w-100 mt-2" id="bkExcel" type="button">' +
          '<i class="fa-solid fa-file-excel"></i> Client list for Excel</button>' +
        '<div class="d-flex gap-2 mt-2">' +
          '<button class="btn btn-outline-xo btn-sm flex-grow-1" id="bkExport" type="button" ' +
            'title="A backup file that can be loaded back in">' +
            '<i class="fa-solid fa-cloud-arrow-down"></i> Backup</button>' +
          '<button class="btn btn-outline-xo btn-sm flex-grow-1" id="bkImportBtn" type="button">' +
            '<i class="fa-solid fa-file-import"></i> Restore</button>' +
          '<input type="file" id="bkImport" accept="application/json,.json" hidden>' +
        '</div>' +
        '<p class="bk-hint mt-1 mb-0">Excel to read and share. Backup to move everything, ' +
          'logos included, to another computer.</p>' +
      '</aside>' +

      '<div class="bk__main">' +

        /* ---------------------------- details -------------------------- */
        '<section class="bk-card">' +
          '<div class="bk-card__head">' +
            '<span class="bk-step">1</span>' +
            '<div><h2 class="h6 mb-0">Client</h2>' +
            '<p class="bk-hint mb-0">What arrives on WhatsApp: company name, number, logo.</p></div>' +
          '</div>' +
          '<div class="row g-3">' +
            '<div class="col-md-6"><label class="form-label" for="bkCompany">Company name</label>' +
              '<input class="form-control" id="bkCompany" placeholder="Al Fajer Contracting LLC"></div>' +
            '<div class="col-md-6"><label class="form-label" for="bkCompanyAr">Company name in Arabic ' +
              '<span class="bk-opt">optional</span></label>' +
              '<input class="form-control" id="bkCompanyAr" dir="rtl" placeholder="الفجر للمقاولات"></div>' +
            '<div class="col-md-4"><label class="form-label" for="bkPhone">Contact number</label>' +
              '<input class="form-control" id="bkPhone" inputmode="tel" placeholder="055 123 4567"></div>' +
            '<div class="col-md-4"><label class="form-label" for="bkContact">Contact person ' +
              '<span class="bk-opt">optional</span></label>' +
              '<input class="form-control" id="bkContact" placeholder="Mr Rashid"></div>' +
            '<div class="col-md-4"><label class="form-label" for="bkNotes">Note ' +
              '<span class="bk-opt">optional</span></label>' +
              '<input class="form-control" id="bkNotes" placeholder="Wants 200 vests before Ramadan"></div>' +
          '</div>' +
          '<label class="bk-check mt-3">' +
            '<input type="checkbox" id="bkSleeves"> ' +
            '<span><b>Also print on the sleeves</b><br>' +
            '<span class="bk-hint">Only tick this once the client has agreed to sleeve printing.</span></span>' +
          '</label>' +
        '</section>' +

        /* ---------------------------- artwork -------------------------- */
        '<section class="bk-card">' +
          '<div class="bk-card__head">' +
            '<span class="bk-step">2</span>' +
            '<div><h2 class="h6 mb-0">Logo and print</h2>' +
            '<p class="bk-hint mb-0">A blurry photo from WhatsApp can be cleaned up here before it goes out.</p></div>' +
          '</div>' +
          '<div class="row g-4">' +
            '<div class="col-lg-5">' +
              '<div class="bk-drop" id="bkDrop">' +
                '<div class="bk-drop__inner" id="bkDropInner">' +
                  '<i class="fa-solid fa-cloud-arrow-up"></i>' +
                  '<b>Drop the logo here</b>' +
                  '<span class="bk-hint">or click to choose · PNG, JPG, WebP</span>' +
                '</div>' +
                '<img id="bkLogoImg" alt="" hidden>' +
                '<div class="bk-spin" id="bkSpin" hidden>' +
                  '<i class="fa-solid fa-circle-notch fa-spin"></i> Cleaning up the logo…</div>' +
              '</div>' +
              '<input type="file" id="bkFile" accept="image/png,image/jpeg,image/webp" hidden>' +
              '<p class="bk-note" id="bkNote">No logo yet. Text-only branding works too.</p>' +
              '<button class="btn btn-link p-0 mt-1" id="bkClearLogo" type="button" hidden ' +
                'style="font-size:.85rem;color:var(--xo-danger);text-decoration:none">' +
                '<i class="fa-solid fa-xmark"></i> Remove this logo</button>' +

              '<label class="bk-check mt-3">' +
                '<input type="checkbox" id="bkTwoLogos"> ' +
                '<span><b>This client has a second logo</b><br>' +
                '<span class="bk-hint">A group mark and a division mark, or an English and ' +
                'an Arabic version.</span></span>' +
              '</label>' +

              '<div id="bkLogo2Wrap" hidden>' +
                '<div class="bk-drop bk-drop--sm" id="bkDrop2">' +
                  '<div class="bk-drop__inner" id="bkDrop2Inner">' +
                    '<i class="fa-solid fa-plus"></i>' +
                    '<span class="bk-hint">Second logo</span>' +
                  '</div>' +
                  '<img id="bkLogo2Img" alt="" hidden>' +
                '</div>' +
                '<input type="file" id="bkFile2" accept="image/png,image/jpeg,image/webp" hidden>' +
                '<label class="bk-check mt-2">' +
                  '<input type="checkbox" id="bkBackLogo2"> ' +
                  '<span><b>Use the second logo on the back</b><br>' +
                  '<span class="bk-hint">Front keeps the first one.</span></span>' +
                '</label>' +
              '</div>' +
            '</div>' +

            '<div class="col-lg-7">' +
              '<label class="bk-check">' +
                '<input type="checkbox" id="bkCut" checked> ' +
                '<span><b>Cut the background out</b><br>' +
                '<span class="bk-hint">Works on a plain or near-plain background.</span></span>' +
              '</label>' +
              '<div class="bk-field" id="bkTolWrap">' +
                '<label class="form-label" for="bkTol">How much background to remove ' +
                  '<b class="num" id="bkTolVal"></b></label>' +
                '<input type="range" class="form-range" id="bkTol" min="10" max="100" step="2">' +
                '<p class="bk-hint mb-0">Turn it up for a shadowed or off-white photo. ' +
                  'Too high starts eating the logo.</p>' +
              '</div>' +

              '<div class="bk-field">' +
                '<label class="form-label" for="bkTarget">Logo resolution</label>' +
                '<select class="form-select" id="bkTarget">' +
                  '<option value="0">Leave it as it came</option>' +
                  '<option value="600">Standard — 600 px</option>' +
                  '<option value="900" selected>Recommended — 900 px</option>' +
                  '<option value="1200">Maximum — 1200 px</option>' +
                '</select>' +
                '<p class="bk-hint mb-0">A small WhatsApp image is enlarged in steps and re-sharpened, ' +
                  'which holds the edges together far better than stretching it once.</p>' +
              '</div>' +

              '<div class="bk-field">' +
                '<label class="form-label" for="bkSharp">Sharpness <b class="num" id="bkSharpVal"></b></label>' +
                '<input type="range" class="form-range" id="bkSharp" min="0" max="90" step="5">' +
              '</div>' +

              '<div class="bk-field">' +
                '<label class="form-label d-block">Print colour</label>' +
                '<label class="bk-check mb-2">' +
                  '<input type="checkbox" id="bkAutoInk" checked> ' +
                  '<span><b>Match the colour to each garment</b><br>' +
                  '<span class="bk-hint">White on a black or navy item, black on a yellow or ' +
                  'orange one. You can override it on any item afterwards.</span></span>' +
                '</label>' +
                '<div class="swatches" id="bkSwatches">' + swatches + '</div>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</section>' +

        /* ---------------------------- products ------------------------- */
        '<section class="bk-card">' +
          '<div class="bk-card__head">' +
            '<span class="bk-step">3</span>' +
            '<div><h2 class="h6 mb-0">Items to brand</h2>' +
            '<p class="bk-hint mb-0">Every item gets the logo on the chest and across the back, ' +
              'placed automatically for that photo.</p></div>' +
          '</div>' +
          '<div class="bk-filters" id="bkFilters"></div>' +
          '<div class="bk-picks" id="bkPicks"><div class="skeleton" style="height:120px"></div></div>' +
          '<div class="bk-actions">' +
            '<button class="btn btn-xo btn-lg-xo" id="bkGo" type="button">' +
              '<i class="fa-solid fa-wand-magic-sparkles"></i> Brand the selected items</button>' +
            '<button class="btn btn-outline-xo" id="bkStop" type="button" hidden>Stop</button>' +
            '<span class="bk-count" id="bkCount"></span>' +
          '</div>' +
          '<div class="bk-progress" id="bkProg" hidden>' +
            '<div class="bk-progress__bar"><span id="bkBar"></span></div>' +
            '<span id="bkProgText"></span>' +
          '</div>' +
        '</section>' +

        /* ---------------------------- output --------------------------- */
        '<section class="bk-card" id="bkOutWrap" hidden>' +
          '<div class="bk-card__head">' +
            '<span class="bk-step">4</span>' +
            '<div><h2 class="h6 mb-0">Ready to send</h2>' +
            '<p class="bk-hint mb-0">Untick anything you do not want in the folder.</p></div>' +
          '</div>' +
          '<div class="bk-outbar">' +
            '<div class="d-flex gap-2 flex-wrap">' +
              '<button class="btn btn-outline-xo btn-sm" id="bkAllOn" type="button">Select all</button>' +
              '<button class="btn btn-outline-xo btn-sm" id="bkAllOff" type="button">Clear</button>' +
            '</div>' +
            '<div class="d-flex gap-2 flex-wrap">' +
              '<button class="btn btn-xo" id="bkZip" type="button">' +
                '<i class="fa-solid fa-folder-open"></i> Download folder (ZIP)</button>' +
              '<button class="btn btn-xo" id="bkPdf" type="button">' +
                '<i class="fa-solid fa-file-pdf"></i> Download catalogue (PDF)</button>' +
              '<button class="btn btn-wa" id="bkWa" type="button">' +
                '<i class="fa-brands fa-whatsapp"></i> Message</button>' +
            '</div>' +
          '</div>' +
          '<div class="bk-out" id="bkOut"></div>' +
        '</section>' +

        '<div class="bk-save">' +
          '<button class="btn btn-xo btn-lg-xo" id="bkSave" type="button">' +
            '<i class="fa-solid fa-floppy-disk"></i> Save this client</button>' +
          '<button class="btn btn-outline-xo" id="bkDelete" type="button" hidden>' +
            '<i class="fa-solid fa-trash-can"></i> Delete</button>' +
          '<span class="bk-hint" id="bkSaveNote"></span>' +
        '</div>' +

      '</div>' +
    '</div>' +

    /* ---------------------------- editor ------------------------------- */
    '<div class="bk-editor" id="bkEditor" hidden>' +
      '<div class="bk-editor__box" role="dialog" aria-modal="true" aria-labelledby="bkEdTitle">' +
        '<div class="bk-editor__head">' +
          '<h2 class="h6 mb-0" id="bkEdTitle">Edit</h2>' +
          '<button class="bk-editor__x" id="bkEdClose" type="button" aria-label="Close">' +
            '<i class="fa-solid fa-xmark"></i></button>' +
        '</div>' +
        '<div class="bk-editor__body">' +
          '<div class="bk-editor__stage">' +
            '<div class="bk-stage" id="bkEdStage">' +
              '<canvas id="bkEdCanvas" width="760" height="760"></canvas>' +
              '<div class="bk-marquee" id="bkEdMarquee" hidden></div>' +
            '</div>' +
            '<p class="bk-hint mt-2 mb-0" id="bkEdHint"></p>' +
          '</div>' +
          '<div class="bk-editor__side">' +

            '<div class="bk-field mt-0">' +
              '<label class="form-label d-block">Which print</label>' +
              '<div class="bk-chips" id="bkEdSpots"></div>' +
            '</div>' +

            '<div class="bk-field">' +
              '<div class="d-flex justify-content-between align-items-center mb-1">' +
                '<label class="form-label mb-0">Layers</label>' +
                '<button class="btn btn-link p-0" id="bkEdAdd" type="button" ' +
                  'style="font-size:.8rem;text-decoration:none">' +
                  '<i class="fa-solid fa-plus"></i> Add text</button>' +
              '</div>' +
              '<div class="bk-layers" id="bkEdLayers"></div>' +
              '<p class="bk-hint mb-0 mt-1">Click a layer to select it, or click it on the ' +
                'picture. The chain links layers so they move together.</p>' +
            '</div>' +

            '<div class="bk-field" id="bkEdAlignWrap">' +
              '<label class="form-label d-block">Align</label>' +
              '<div class="bk-align" id="bkEdAlign">' +
                '<button type="button" data-al="left" title="Align left">' +
                  '<i class="fa-solid fa-align-left"></i></button>' +
                '<button type="button" data-al="cx" title="Centre across">' +
                  '<i class="fa-solid fa-align-center"></i></button>' +
                '<button type="button" data-al="right" title="Align right">' +
                  '<i class="fa-solid fa-align-right"></i></button>' +
                '<span class="bk-align__sep"></span>' +
                '<button type="button" data-al="top" title="Align top">' +
                  '<i class="fa-solid fa-arrow-up-long"></i></button>' +
                '<button type="button" data-al="cy" title="Centre down">' +
                  '<i class="fa-solid fa-arrows-up-down"></i></button>' +
                '<button type="button" data-al="bottom" title="Align bottom">' +
                  '<i class="fa-solid fa-arrow-down-long"></i></button>' +
                '<span class="bk-align__sep"></span>' +
                '<button type="button" data-al="centre" title="Centre on the print">' +
                  '<i class="fa-solid fa-crosshairs"></i></button>' +
              '</div>' +
              '<label class="form-label mt-2" for="bkEdGap">Line spacing ' +
                '<b class="num" id="bkEdGapVal"></b></label>' +
              '<input type="range" class="form-range" id="bkEdGap" min="0" max="200" step="5">' +
              '<p class="bk-hint mb-0">Spreads the selected lines out evenly. With nothing ' +
                'selected it spaces every line on this print.</p>' +
            '</div>' +

            '<div class="bk-field" id="bkEdSelWrap">' +
              '<label class="form-label d-block" id="bkEdSelName">Selected layer</label>' +

              '<input class="form-control form-control-sm mb-2" id="bkEdSelText" ' +
                'placeholder="Text of this layer" hidden>' +

              '<label class="form-label" for="bkEdSelSize">Size ' +
                '<b class="num" id="bkEdSelSizeVal"></b></label>' +
              '<input type="range" class="form-range mb-2" id="bkEdSelSize" ' +
                'min="10" max="400" step="5">' +

              '<label class="form-label d-block">Colour of this layer</label>' +
              '<div class="swatches" id="bkEdInk">' + swatches +
                '<button type="button" class="swatch swatch--custom" id="bkEdPick" ' +
                  'title="Any other colour" aria-label="Any other colour">' +
                  '<i class="fa-solid fa-eye-dropper"></i></button>' +
              '</div>' +
              '<button class="btn btn-link p-0 mt-1" id="bkEdOriginal" type="button" hidden ' +
                'style="font-size:.8rem;text-decoration:none">' +
                '<i class="fa-solid fa-rotate-left"></i> Keep the logo\'s own colours</button>' +

              '<div id="bkEdPalWrap" hidden class="mt-3">' +
                '<label class="form-label d-block mb-1">Colours inside this logo</label>' +
                '<div class="bk-pal" id="bkEdPal"></div>' +
                '<p class="bk-hint mb-0 mt-1">Click one to replace just that colour, the way ' +
                  'you would recolour a vector. Works on flat artwork.</p>' +
              '</div>' +
            '</div>' +

            '<div class="bk-field" id="bkEdLayWrap">' +
              '<label class="form-label d-block">Re-arrange automatically</label>' +
              '<div class="bk-seg" id="bkEdLayout">' +
                '<button type="button" data-lay="stack" title="Logo above the text">' +
                  '<i class="fa-solid fa-bars-staggered fa-rotate-90"></i> Stacked</button>' +
                '<button type="button" data-lay="left" title="Logo to the left of the text">' +
                  '<i class="fa-solid fa-align-left"></i> Logo left</button>' +
                '<button type="button" data-lay="right" title="Logo to the right of the text">' +
                  '<i class="fa-solid fa-align-right"></i> Logo right</button>' +
              '</div>' +
              '<button class="btn btn-link p-0 mt-1" id="bkEdAuto" type="button" ' +
                'style="font-size:.82rem;text-decoration:none">' +
                '<i class="fa-solid fa-wand-magic-sparkles"></i> Match colours to the garment</button>' +
            '</div>' +

            '</div>' +

            '<div class="bk-editor__foot">' +
              '<button class="btn btn-xo w-100" id="bkEdDone" type="button">' +
                '<i class="fa-solid fa-check"></i> Done</button>' +
              '<div class="d-flex gap-2 mt-2">' +
                '<button class="btn btn-outline-xo btn-sm flex-grow-1" id="bkEdReset" type="button">' +
                  'Start over</button>' +
                '<button class="btn btn-outline-xo btn-sm flex-grow-1" id="bkEdPrev" type="button">' +
                  '<i class="fa-solid fa-chevron-left"></i> Prev</button>' +
                '<button class="btn btn-outline-xo btn-sm flex-grow-1" id="bkEdNext" type="button">' +
                  'Next <i class="fa-solid fa-chevron-right"></i></button>' +
              '</div>' +
            '</div>' +

          '</div>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  /* =======================================================================
     Boot
     ======================================================================= */

  var el = {};

  function boot() {
    var mount = XO.el('#bkApp');
    if (!mount) return;
    mount.innerHTML = shell();

    [
      'bkNew', 'bkSearch', 'bkList', 'bkStorage', 'bkExport', 'bkExcel', 'bkImportBtn', 'bkImport',
      'bkCompany', 'bkCompanyAr', 'bkPhone', 'bkContact', 'bkNotes', 'bkSleeves',
      'bkDrop', 'bkDropInner', 'bkLogoImg', 'bkSpin', 'bkFile', 'bkNote', 'bkClearLogo',
      'bkTwoLogos', 'bkLogo2Wrap', 'bkDrop2', 'bkDrop2Inner', 'bkLogo2Img', 'bkFile2', 'bkBackLogo2',
      'bkCut', 'bkTolWrap', 'bkTol', 'bkTolVal', 'bkTarget', 'bkSharp', 'bkSharpVal', 'bkSwatches',
      'bkFilters', 'bkPicks', 'bkGo', 'bkStop', 'bkCount', 'bkProg', 'bkBar', 'bkProgText',
      'bkOutWrap', 'bkOut', 'bkAllOn', 'bkAllOff', 'bkZip', 'bkPdf', 'bkWa',
      'bkSave', 'bkDelete', 'bkSaveNote', 'bkAutoInk',
      'bkEditor', 'bkEdTitle', 'bkEdClose', 'bkEdCanvas', 'bkEdHint', 'bkEdSpots',
      'bkEdStage', 'bkEdMarquee', 'bkEdAlign', 'bkEdAlignWrap', 'bkEdGap', 'bkEdGapVal',
      'bkEdPal', 'bkEdPalWrap',
      'bkEdLayers', 'bkEdAdd', 'bkEdSelWrap', 'bkEdSelName', 'bkEdSelText',
      'bkEdSelSize', 'bkEdSelSizeVal', 'bkEdOriginal',
      'bkEdLayout', 'bkEdLayWrap', 'bkEdInk', 'bkEdPick', 'bkEdAuto', 'bkEdDone', 'bkEdReset',
      'bkEdPrev', 'bkEdNext'
    ].forEach(function (id) { el[id] = XO.el('#' + id); });

    wire();
    paintState();
    renderClients();
    Catalog.load().then(function (list) {
      /* Only ranges you can actually print on. Nobody brands a tape measure,
         and offering 180 items would bury the ones the client is buying. */
      var printable = {}, preselect = {};
      CFG.CATEGORIES.forEach(function (c) {
        if (c.printable) printable[c.slug] = true;
        if (c.nav && c.printable) preselect[c.slug] = true;
      });
      products = list.filter(function (p) { return printable[p.category]; });
      /* Vests and uniforms are ticked to start with — the rest are one click. */
      products.forEach(function (p) { S.picks[p.uid] = !!preselect[p.category]; });
      renderFilters();
      renderPicks();
    }).catch(function () {
      el.bkPicks.innerHTML = '<p class="text-muted-xo mb-0">The catalogue could not be loaded. ' +
        'Check your connection and reload.</p>';
    });
  }

  /* =======================================================================
     Wiring
     ======================================================================= */

  function wire() {
    ['bkCompany', 'bkCompanyAr', 'bkPhone', 'bkContact', 'bkNotes'].forEach(function (id) {
      el[id].addEventListener('input', function () {
        S[id.replace('bk', '').charAt(0).toLowerCase() + id.replace('bk', '').slice(1)] = el[id].value;
        S.dirty = true;
      });
    });

    el.bkSleeves.addEventListener('change', function () { S.sleeves = el.bkSleeves.checked; S.dirty = true; });

    el.bkAutoInk.addEventListener('change', function () {
      S.autoInk = el.bkAutoInk.checked;
      S.dirty = true;
    });

    wireEditor();

    el.bkNew.addEventListener('click', function () { reset(); XO.toast('Started a new client', 'fa-plus'); });
    el.bkSearch.addEventListener('input', renderClients);

    /* ---- logo ---- */
    el.bkDrop.addEventListener('click', function () { el.bkFile.click(); });
    el.bkFile.addEventListener('change', function () {
      if (el.bkFile.files && el.bkFile.files[0]) processLogo(el.bkFile.files[0]);
    });
    ['dragenter', 'dragover'].forEach(function (ev) {
      el.bkDrop.addEventListener(ev, function (e) {
        e.preventDefault(); el.bkDrop.classList.add('is-over');
      });
    });
    ['dragleave', 'drop'].forEach(function (ev) {
      el.bkDrop.addEventListener(ev, function (e) {
        e.preventDefault(); el.bkDrop.classList.remove('is-over');
      });
    });
    el.bkDrop.addEventListener('drop', function (e) {
      var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) processLogo(f);
    });
    el.bkTwoLogos.addEventListener('change', function () {
      S.twoLogos = el.bkTwoLogos.checked;
      el.bkLogo2Wrap.hidden = !S.twoLogos;
      if (!S.twoLogos) { S.logo2 = ''; S.backLogo2 = false; el.bkBackLogo2.checked = false; }
      S.dirty = true;
      paintLogo();
    });
    el.bkBackLogo2.addEventListener('change', function () {
      S.backLogo2 = el.bkBackLogo2.checked;
      S.dirty = true;
    });
    el.bkDrop2.addEventListener('click', function () { el.bkFile2.click(); });
    el.bkFile2.addEventListener('change', function () {
      if (el.bkFile2.files && el.bkFile2.files[0]) processLogo(el.bkFile2.files[0], 2);
    });
    ['dragenter', 'dragover'].forEach(function (ev) {
      el.bkDrop2.addEventListener(ev, function (e) { e.preventDefault(); el.bkDrop2.classList.add('is-over'); });
    });
    ['dragleave', 'drop'].forEach(function (ev) {
      el.bkDrop2.addEventListener(ev, function (e) { e.preventDefault(); el.bkDrop2.classList.remove('is-over'); });
    });
    el.bkDrop2.addEventListener('drop', function (e) {
      var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) processLogo(f, 2);
    });

    el.bkClearLogo.addEventListener('click', function (e) {
      e.stopPropagation();
      S.logo = ''; S.logoName = ''; S.logoPx = 0; logoImg = null; S.dirty = true;
      el.bkFile.value = '';
      paintLogo();
    });

    el.bkCut.addEventListener('change', function () {
      S.cut = el.bkCut.checked;
      el.bkTolWrap.hidden = !S.cut;
      reprocess();
    });
    el.bkTol.addEventListener('input', function () {
      S.tolerance = parseInt(el.bkTol.value, 10);
      el.bkTolVal.textContent = S.tolerance;
    });
    el.bkTol.addEventListener('change', reprocess);
    el.bkTarget.addEventListener('change', function () {
      S.target = parseInt(el.bkTarget.value, 10); reprocess();
    });
    el.bkSharp.addEventListener('input', function () {
      S.sharpAmount = parseInt(el.bkSharp.value, 10);
      el.bkSharpVal.textContent = S.sharpAmount + '%';
    });
    el.bkSharp.addEventListener('change', reprocess);

    XO.els('.swatch', el.bkSwatches).forEach(function (b) {
      b.addEventListener('click', function () {
        XO.els('.swatch', el.bkSwatches).forEach(function (o) { o.classList.remove('is-active'); });
        b.classList.add('is-active');
        S.colour = b.getAttribute('data-hex');
        S.dirty = true;
      });
    });

    /* ---- generate ---- */
    el.bkGo.addEventListener('click', generate);
    el.bkStop.addEventListener('click', function () { cancelled = true; });

    el.bkAllOn.addEventListener('click', function () { setAllResults(true); });
    el.bkAllOff.addEventListener('click', function () { setAllResults(false); });
    el.bkZip.addEventListener('click', downloadZip);
    el.bkPdf.addEventListener('click', downloadPdf);
    el.bkWa.addEventListener('click', whatsapp);

    /* ---- records ---- */
    el.bkSave.addEventListener('click', saveCurrent);
    el.bkDelete.addEventListener('click', deleteCurrent);
    el.bkExport.addEventListener('click', exportAll);
    el.bkExcel.addEventListener('click', exportExcel);
    el.bkImportBtn.addEventListener('click', function () { el.bkImport.click(); });
    el.bkImport.addEventListener('change', function () {
      if (el.bkImport.files && el.bkImport.files[0]) importFile(el.bkImport.files[0]);
    });

    window.addEventListener('beforeunload', function (e) {
      if (!S.dirty) return;
      e.preventDefault();
      e.returnValue = '';
    });
  }

  /* =======================================================================
     Painting the form from state
     ======================================================================= */

  function paintState() {
    el.bkCompany.value = S.company;
    el.bkCompanyAr.value = S.companyAr;
    el.bkPhone.value = S.phone;
    el.bkContact.value = S.contact;
    el.bkNotes.value = S.notes;
    el.bkSleeves.checked = !!S.sleeves;
    el.bkAutoInk.checked = S.autoInk !== false;
    el.bkTwoLogos.checked = !!S.twoLogos;
    el.bkLogo2Wrap.hidden = !S.twoLogos;
    el.bkBackLogo2.checked = !!S.backLogo2;
    el.bkCut.checked = !!S.cut;
    el.bkTolWrap.hidden = !S.cut;
    el.bkTol.value = S.tolerance;
    el.bkTolVal.textContent = S.tolerance;
    el.bkTarget.value = String(S.target);
    el.bkSharp.value = S.sharpAmount;
    el.bkSharpVal.textContent = S.sharpAmount + '%';
    el.bkDelete.hidden = !S.id;

    XO.els('.swatch', el.bkSwatches).forEach(function (b) {
      b.classList.toggle('is-active', b.getAttribute('data-hex') === S.colour);
    });
    paintLogo();
  }

  function paintLogo() {
    var has = !!S.logo;
    el.bkLogoImg.hidden = !has;
    el.bkDropInner.hidden = has;
    el.bkClearLogo.hidden = !has;
    if (has) el.bkLogoImg.src = S.logo;
    else el.bkNote.innerHTML = 'No logo yet. Text-only branding works too.';

    var has2 = !!S.logo2;
    el.bkLogo2Img.hidden = !has2;
    el.bkDrop2Inner.hidden = has2;
    if (has2) el.bkLogo2Img.src = S.logo2;
    el.bkBackLogo2.disabled = !has2;
  }

  function reset() {
    S.id = null;
    S.company = S.companyAr = S.phone = S.contact = S.notes = '';
    S.logo = ''; S.logoName = ''; S.logoPx = 0; S.removedBg = false;
    S.logo2 = ''; S.logo2Name = ''; S.twoLogos = false; S.backLogo2 = false;
    logoImg2 = null; rawFileImage2 = null;
    S.sleeves = false;
    S.dirty = false;
    logoImg = null;
    el.bkFile.value = '';
    clearResults();
    paintState();
    renderClients();
  }

  /* =======================================================================
     Logo processing
     ======================================================================= */

  var rawFileImage = null;    // the untouched uploads, so the sliders can re-run
  var rawFileImage2 = null;

  function processLogo(file, slot) {
    slot = slot || 1;
    if (!file) return;
    if (file.size > (CFG.PRINTING.maxFileMB || 10) * 1024 * 1024) {
      el.bkNote.innerHTML = '<span class="bk-bad">That file is over ' +
        (CFG.PRINTING.maxFileMB || 10) + ' MB. Please use a smaller one.</span>';
      return;
    }
    if (slot === 1) S.logoName = file.name; else S.logo2Name = file.name;

    var reader = new FileReader();
    reader.onload = function () {
      E.loadImage(reader.result, false).then(function (img) {
        if (slot === 1) {
          rawFileImage = img;
          S.logoPx = Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height);
        } else {
          rawFileImage2 = img;
        }
        return reprocess();
      }).catch(function () {
        el.bkNote.innerHTML = '<span class="bk-bad">That image could not be opened.</span>';
      });
    };
    reader.readAsDataURL(file);
  }

  /* Both logos go through the same clean-up, so one set of controls covers
     them. Returns the finished data URL. */
  function cleanLogo(src) {
    var work = E.downscale(src, 1400);
    var out, removed = 0;

    if (S.cut) {
      var r = E.removeBackground(work, S.tolerance);
      removed = r.removed;
      out = E.trim(r.canvas);
      S.removedBg = true;
    } else {
      out = work;
      S.removedBg = false;
    }

    if (S.target && Math.max(out.width, out.height) < S.target) {
      out = E.upscale(out, S.target);
    }
    if (S.sharpAmount > 0) out = E.sharpen(out, S.sharpAmount / 100);
    out = E.downscale(out, Math.max(900, S.target || 900));

    return { url: out.toDataURL('image/png'), removed: removed };
  }

  function reprocess() {
    if (!rawFileImage && !rawFileImage2) return Promise.resolve();
    el.bkSpin.hidden = false;

    return new Promise(function (resolve) {
      setTimeout(function () {
        var removed = 0;
        var jobs = [];

        if (rawFileImage) {
          var a = cleanLogo(rawFileImage);
          removed = a.removed;
          S.logo = a.url;
          jobs.push(E.loadImage(S.logo, false).then(function (li) { logoImg = li; }));
        }
        if (rawFileImage2) {
          var b = cleanLogo(rawFileImage2);
          S.logo2 = b.url;
          jobs.push(E.loadImage(S.logo2, false).then(function (li) { logoImg2 = li; }));
        }
        S.dirty = true;

        Promise.all(jobs).then(function () {
          el.bkSpin.hidden = true;
          paintLogo();
          note(removed);
          resolve();
        });
      }, 30);
    });
  }

  function note(removed) {
    var bits = [];
    if (S.cut && removed < 0.02) {
      bits.push('<span class="bk-warn">Hardly any background came off — the photo is probably busy. ' +
        'Turn the slider up, or untick the box and we will cut it by hand.</span>');
    } else if (S.cut && removed > 0.985) {
      bits.push('<span class="bk-bad">Almost the whole image was removed. Turn the slider down.</span>');
    }
    var q = S.logoPx < 200
      ? '<span class="bk-bad">Arrived at ' + S.logoPx + ' px — very low. Ask the client for the original file if you can.</span>'
      : S.logoPx < 600
        ? '<span class="bk-warn">Arrived at ' + S.logoPx + ' px — usable, and sharpened for print.</span>'
        : '<span class="bk-good"><i class="fa-solid fa-circle-check"></i> Arrived at ' + S.logoPx + ' px — good quality.</span>';
    bits.push(q);
    el.bkNote.innerHTML = bits.join('<br>');
  }

  /* =======================================================================
     Product picking
     ======================================================================= */

  function renderFilters() {
    var cats = CFG.CATEGORIES.map(function (c) {
      var n = products.filter(function (p) { return p.category === c.slug; }).length;
      if (!n) return '';
      return '<div class="bk-filter"><b>' + XO.esc(c.name) + '</b>' +
        '<button class="btn btn-link p-0" type="button" data-cat-on="' + c.slug + '">All</button>' +
        '<button class="btn btn-link p-0" type="button" data-cat-off="' + c.slug + '">None</button></div>';
    }).join('');
    el.bkFilters.innerHTML = cats;

    XO.els('[data-cat-on]', el.bkFilters).forEach(function (b) {
      b.addEventListener('click', function () { setCat(b.getAttribute('data-cat-on'), true); });
    });
    XO.els('[data-cat-off]', el.bkFilters).forEach(function (b) {
      b.addEventListener('click', function () { setCat(b.getAttribute('data-cat-off'), false); });
    });
  }

  function setCat(slug, on) {
    products.forEach(function (p) { if (p.category === slug) S.picks[p.uid] = on; });
    renderPicks();
  }

  function renderPicks() {
    el.bkPicks.innerHTML = products.map(function (p) {
      return '<label class="bk-pick' + (S.picks[p.uid] ? ' is-on' : '') + '" data-uid="' + XO.esc(p.uid) + '">' +
        '<input type="checkbox"' + (S.picks[p.uid] ? ' checked' : '') + '>' +
        '<span class="bk-pick__img">' + (p.images[0]
          ? '<img src="' + XO.esc(p.images[0]) + '" alt="" loading="lazy" crossorigin="anonymous">'
          : '<i class="fa-solid fa-image"></i>') + '</span>' +
        '<span class="bk-pick__t">' + XO.esc(p.title) + '</span>' +
      '</label>';
    }).join('');

    XO.els('.bk-pick', el.bkPicks).forEach(function (lab) {
      var uid = lab.getAttribute('data-uid');
      XO.el('input', lab).addEventListener('change', function (e) {
        S.picks[uid] = e.target.checked;
        lab.classList.toggle('is-on', e.target.checked);
        countPicks();
      });
    });
    countPicks();
  }

  function picked() {
    return products.filter(function (p) { return S.picks[p.uid]; });
  }

  function countPicks() {
    var n = picked().length;
    el.bkCount.textContent = n + ' of ' + products.length + ' items selected';
    el.bkGo.disabled = !n;
  }

  /* =======================================================================
     Generating the mockups
     ======================================================================= */

  function textLines() {
    return [S.company, S.companyAr, S.phone].map(function (v) {
      return (v || '').trim();
    }).filter(Boolean);
  }

  function clearResults() {
    if (!el.bkEditor.hidden) closeEditor();
    results.forEach(function (r) { if (r.url) URL.revokeObjectURL(r.url); });
    results = [];
    el.bkOut.innerHTML = '';
    el.bkOutWrap.hidden = true;
  }

  function generate() {
    if (running) return;
    var list = picked();
    if (!list.length) return;
    if (!S.logo && !textLines().length) {
      XO.toast('Add a logo or a company name first', 'fa-triangle-exclamation');
      return;
    }

    running = true; cancelled = false;
    clearResults();
    el.bkGo.disabled = true;
    el.bkStop.hidden = false;
    el.bkProg.hidden = false;

    var canvas = document.createElement('canvas');
    var done = 0, failed = [];

    function step(i) {
      if (cancelled || i >= list.length) return finish(failed);
      var p = list[i];
      el.bkProgText.textContent = 'Branding ' + (i + 1) + ' of ' + list.length + ' — ' + p.title;
      el.bkBar.style.width = Math.round(i / list.length * 100) + '%';

      one(p, canvas).then(function (r) {
        if (r) { results.push(r); done++; }
        else failed.push(p.title);
        step(i + 1);
      }).catch(function () {
        failed.push(p.title);
        step(i + 1);
      });
    }

    function finish(failed) {
      running = false;
      el.bkStop.hidden = true;
      el.bkGo.disabled = false;
      el.bkProg.hidden = true;
      el.bkBar.style.width = '0%';
      renderResults();
      if (failed.length) {
        XO.toast(results.length + ' branded · ' + failed.length + ' photo(s) unavailable', 'fa-triangle-exclamation');
      } else if (cancelled) {
        XO.toast('Stopped — ' + results.length + ' ready', 'fa-circle-stop');
      } else {
        XO.toast(results.length + ' items branded for ' + (S.company || 'this client'));
      }
    }

    step(0);
  }

  /* Builds the starting design for one product. Positions come from the
     photo; ink follows the garment unless a colour has been forced. */
  function freshDesign(img, analysis) {
    var spots = E.spotsFor(BK.placement || 'Left chest + full back', analysis);
    if (S.sleeves) spots = spots.concat(E.spotsFor(BK.sleevePlacement || 'Both sleeves', analysis));

    var logos = [logoImg, logoImg2].filter(Boolean);

    /* When the client has two marks and has asked for the second on the back,
       the back print is told to use it. */
    if (S.twoLogos && S.backLogo2 && logos.length > 1) {
      spots.forEach(function (s) {
        if (/back/i.test(s.label || '')) s.logoIndex = 1;
      });
    }

    var design = {
      lines: textLines().slice(),
      autoInk: S.autoInk !== false,
      inkColour: S.colour,
      _logoImg: logos[0] || null,
      _logoImgs: logos,
      _spots: spots,
      _showGuides: false
    };
    applyInk(img, design);
    return design;
  }

  function applyInk(img, design) {
    design._spots.forEach(function (s) {
      s.ink = design.autoInk ? E.inkFor(img, s) : (design.inkColour || S.colour);
    });
  }

  /* Draws a result and refreshes its files and thumbnail. Used both when the
     batch first runs and every time the salesperson edits one. */
  function renderResult(r, canvas) {
    var cv = canvas || document.createElement('canvas');
    E.drawMockup(cv, r.img, r.design);

    return XOPack.canvasBlob(cv, 'image/png').then(function (pngBlob) {
      return XOPack.blobToU8(pngBlob).then(function (png) {
        return XOPack.canvasBlob(cv, 'image/jpeg', BK.pdfQuality || 0.88)
          .then(function (jpgBlob) {
            return XOPack.blobToU8(jpgBlob).then(function (jpeg) {
              if (r.url) URL.revokeObjectURL(r.url);
              r.png = png;
              r.jpeg = jpeg;
              r.w = cv.width;
              r.h = cv.height;
              r.url = URL.createObjectURL(pngBlob);
              return r;
            });
          });
      });
    });
  }

  function one(p, canvas) {
    var src = p.images[0];
    if (!src) return Promise.resolve(null);

    return E.loadImage(src, true).then(function (img) {
      var analysis = E.analysePhoto(img);
      var r = {
        uid: p.uid, title: p.title, price: p.price,
        category: p.categoryName, sizes: p.sizes,
        img: img, analysis: analysis,
        design: freshDesign(img, analysis),
        on: true, edited: false
      };
      return renderResult(r, canvas);
    }).catch(function () { return null; });
  }

  /* =======================================================================
     Per-item editor
     -----------------------------------------------------------------------
     Automatic placement gets close, but a chest badge sitting over a zip or a
     pocket needs a human eye. This opens one item at a time so the print can
     be dragged, resized and recoloured before anything is downloaded.
     ======================================================================= */

  var edIndex = -1;
  var edActive = 0;          // which print position
  var edPick = [];           // selected layer indexes, in the order picked
  var edDragging = false;
  var edGrab = null;
  var edMarquee = null;

  function edItem() { return results[edIndex] || null; }
  function edSpot() {
    var r = edItem();
    return r ? r.design._spots[edActive] : null;
  }
  function edLayers() {
    var s = edSpot();
    return (s && s.layers) || [];
  }
  function edSel() {
    var L = edLayers();
    return edPick.map(function (i) { return L[i]; }).filter(Boolean);
  }
  function edOne() {
    var sel = edSel();
    return sel.length ? sel[sel.length - 1] : null;
  }
  function edRect() {
    var r = edItem();
    return (r && r.design._rect) || { x: 0, y: 0, w: 1, h: 1 };
  }

  function openEditor(i) {
    if (!results[i]) return;
    edIndex = i;
    edActive = 0;
    edPick = [0];
    el.bkEditor.hidden = false;
    document.body.style.overflow = 'hidden';
    paintEditor();
  }

  function closeEditor() {
    el.bkEditor.hidden = true;
    document.body.style.overflow = '';
    edIndex = -1;
  }

  function layerLabel(L) {
    if (L.kind === 'logo') return 'Logo' + (L.logoIndex ? ' 2' : '');
    return L.text ? (L.text.length > 20 ? L.text.slice(0, 20) + '…' : L.text) : 'Empty line';
  }

  /* ---------------------------------------------------------------- paint */

  function paintEditor() {
    var r = edItem();
    if (!r) return;
    var d = r.design;
    if (edActive >= d._spots.length) edActive = 0;

    el.bkEdTitle.textContent = r.title;

    el.bkEdSpots.innerHTML = d._spots.map(function (s, i) {
      return '<button type="button" class="bk-chip' + (i === edActive ? ' is-active' : '') +
        '" data-spot="' + i + '">' + XO.esc(s.label || ('Print ' + (i + 1))) + '</button>';
    }).join('');
    XO.els('.bk-chip', el.bkEdSpots).forEach(function (b) {
      b.addEventListener('click', function () {
        edActive = parseInt(b.getAttribute('data-spot'), 10);
        edPick = [0];
        paintEditor();
      });
    });

    d._active = edActive;
    edPaintCanvas();

    var layers = edLayers();
    edPick = edPick.filter(function (i) { return i >= 0 && i < layers.length; });
    if (!edPick.length && layers.length) edPick = [0];

    el.bkEdLayers.innerHTML = layers.map(function (L, i) {
      var on = edPick.indexOf(i) > -1;
      return '<div class="bk-layer' + (on ? ' is-active' : '') +
        (L.group ? ' is-linked' : '') + '" data-layer="' + i + '">' +
        '<span class="bk-layer__ico"><i class="fa-solid ' +
          (L.kind === 'logo' ? 'fa-image' : 'fa-font') + '"></i></span>' +
        '<span class="bk-layer__t">' + XO.esc(layerLabel(L)) + '</span>' +
        '<button type="button" class="bk-layer__b" data-link="' + i + '" ' +
          'title="' + (L.group ? 'Unlink' : 'Link so it always moves with the others') + '">' +
          '<i class="fa-solid ' + (L.group ? 'fa-link' : 'fa-link-slash') + '"></i></button>' +
        (L.kind === 'text'
          ? '<button type="button" class="bk-layer__b bk-layer__b--x" data-del="' + i + '" ' +
            'title="Remove this line"><i class="fa-solid fa-xmark"></i></button>'
          : '<span class="bk-layer__b"></span>') +
      '</div>';
    }).join('') || '<p class="bk-hint mb-0">Nothing on this print yet.</p>';

    XO.els('.bk-layer', el.bkEdLayers).forEach(function (row) {
      var i = parseInt(row.getAttribute('data-layer'), 10);
      row.addEventListener('click', function (e) {
        if (e.target.closest('[data-link]') || e.target.closest('[data-del]')) return;
        choose(i, e.shiftKey || e.ctrlKey || e.metaKey);
      });
    });
    XO.els('[data-link]', el.bkEdLayers).forEach(function (b) {
      b.addEventListener('click', function (e) {
        e.stopPropagation();
        toggleLink(parseInt(b.getAttribute('data-link'), 10));
      });
    });
    XO.els('[data-del]', el.bkEdLayers).forEach(function (b) {
      b.addEventListener('click', function (e) {
        e.stopPropagation();
        removeLayer(parseInt(b.getAttribute('data-del'), 10));
      });
    });

    paintSelected();

    var spot = edSpot();
    var hasLogo = layers.some(function (L) { return L.kind === 'logo'; });
    var hasText = layers.some(function (L) { return L.kind === 'text'; });
    el.bkEdLayWrap.hidden = !(hasLogo && hasText);
    el.bkEdAlignWrap.hidden = layers.length < 2;
    XO.els('button', el.bkEdLayout).forEach(function (b) {
      b.classList.toggle('is-active', b.getAttribute('data-lay') === (spot.layout || 'stack'));
    });

    el.bkEdHint.innerHTML = 'Drag to move. <b>Shift-click</b> or drag a box round several ' +
      'layers to pick more than one.';
  }

  function paintSelected() {
    var sel = edSel();
    if (!sel.length) { el.bkEdSelWrap.hidden = true; return; }
    el.bkEdSelWrap.hidden = false;

    var L = edOne();
    var many = sel.length > 1;

    el.bkEdSelName.textContent = many
      ? sel.length + ' layers selected'
      : (L.kind === 'logo' ? 'Logo' : 'Line of text');

    el.bkEdSelText.hidden = many || L.kind !== 'text';
    if (!many && L.kind === 'text') {
      el.bkEdSelText.value = L.text || '';
      el.bkEdSelText.setAttribute('dir', E.isArabic(L.text) ? 'rtl' : 'ltr');
    }

    var pct = Math.round((L.scale || 1) * 100);
    el.bkEdSelSize.value = Math.max(10, Math.min(400, pct));
    el.bkEdSelSizeVal.textContent = pct + '%';

    var current = L.kind === 'logo' ? L.tint : L.ink;
    var known = false;
    XO.els('.swatch', el.bkEdInk).forEach(function (b) {
      var hit = b.getAttribute('data-hex') === current;
      if (hit) known = true;
      b.classList.toggle('is-active', hit);
    });
    el.bkEdPick.style.setProperty('--sw', current || 'transparent');
    el.bkEdPick.classList.toggle('is-active', !!current && !known);

    var soloLogo = !many && L.kind === 'logo';
    el.bkEdOriginal.hidden = !soloLogo;
    paintPalette(soloLogo ? L : null);
  }

  /* The colours the logo is actually made of, each swappable on its own. */
  function paintPalette(L) {
    var r = edItem();
    if (!L || !r) { el.bkEdPalWrap.hidden = true; return; }

    var img = E.logoSource(r.design, L);
    if (!img) { el.bkEdPalWrap.hidden = true; return; }

    var pal = E.logoPalette(img, 6);
    if (!pal.length) { el.bkEdPalWrap.hidden = true; return; }
    el.bkEdPalWrap.hidden = false;

    var map = L.recolour || {};
    el.bkEdPal.innerHTML = pal.map(function (c) {
      var to = map[c.hex];
      return '<button type="button" class="bk-pal__c' + (to ? ' is-changed' : '') +
        '" data-from="' + c.hex + '" title="' + c.hex +
        (to ? ' → ' + to : '') + '">' +
        '<span style="background:' + (to || c.hex) + '"></span>' +
        (to ? '<i class="fa-solid fa-arrow-right-arrow-left"></i>' : '') +
      '</button>';
    }).join('') +
      (Object.keys(map).length
        ? '<button type="button" class="bk-pal__reset" id="bkEdPalReset" ' +
          'title="Put the original colours back"><i class="fa-solid fa-rotate-left"></i></button>'
        : '');

    XO.els('[data-from]', el.bkEdPal).forEach(function (b) {
      b.addEventListener('click', function () {
        var from = b.getAttribute('data-from');
        var cur = (L.recolour && L.recolour[from]) || from;
        XOColour.open({
          hex: cur,
          trigger: b,
          onChange: function (hex) {
            L.recolour = L.recolour || {};
            L.recolour[from] = hex;
            edPaintCanvas();
          },
          onDone: function (hex) {
            L.recolour = L.recolour || {};
            L.recolour[from] = hex;
            L.tint = null;
            r.edited = true;
            paintSelected();
            edPaintCanvas();
          }
        });
      });
    });
    var reset = XO.el('#bkEdPalReset', el.bkEdPal);
    if (reset) reset.addEventListener('click', function () {
      L.recolour = null;
      r.edited = true;
      paintSelected();
      edPaintCanvas();
    });
  }

  function edPaintCanvas() {
    var r = edItem();
    if (!r) return;
    r.design._showGuides = true;
    r.design._active = edActive;
    r.design._activeLayer = edPick.length === 1 ? edPick[0] : null;
    E.drawMockup(el.bkEdCanvas, r.img, r.design);
    paintPickOutlines();
  }

  /* A light box round everything selected, so a multiple selection is
     obvious even though only one gets the dashed guide. */
  function paintPickOutlines() {
    if (edPick.length < 2) return;
    var s = edSpot();
    if (!s || !s._boxes) return;
    var ctx = el.bkEdCanvas.getContext('2d');
    ctx.save();
    ctx.strokeStyle = '#FFB800';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    edPick.forEach(function (i) {
      var b = s._boxes.filter(function (o) { return o.i === i; })[0];
      if (!b) return;
      ctx.strokeRect(b.x - 4, b.y - 4, b.w + 8, b.h + 8);
    });
    ctx.restore();
  }

  /* ------------------------------------------------------------ selecting */

  function choose(i, add) {
    if (add) {
      var at = edPick.indexOf(i);
      if (at > -1) { if (edPick.length > 1) edPick.splice(at, 1); }
      else edPick.push(i);
    } else {
      edPick = [i];
    }
    paintEditor();
  }

  function toggleLink(i) {
    var s = edSpot();
    if (!s || !s.layers[i]) return;
    var L = s.layers[i];
    if (L.group) {
      L.group = null;
    } else {
      var g = null;
      s.layers.forEach(function (o) { if (o.group) g = o.group; });
      L.group = g || ('g' + Date.now().toString(36));
    }
    edItem().edited = true;
    paintEditor();
  }

  function removeLayer(i) {
    var s = edSpot();
    if (!s || !s.layers[i]) return;
    s.layers.splice(i, 1);
    edPick = [Math.max(0, Math.min(i, s.layers.length - 1))];
    edItem().edited = true;
    paintEditor();
  }

  /* -------------------------------------------------------------- dragging */

  function edPoint(e) {
    var box = el.bkEdCanvas.getBoundingClientRect();
    var pt = e.touches && e.touches.length ? e.touches[0] : e;
    var fx = (pt.clientX - box.left) / box.width;
    var fy = (pt.clientY - box.top) / box.height;
    var R = edRect();
    return {
      fx: fx, fy: fy,
      cx: fx * el.bkEdCanvas.width,
      cy: fy * el.bkEdCanvas.height,
      px: (fx - R.x) / R.w,
      py: (fy - R.y) / R.h
    };
  }

  function edStart(e) {
    var r = edItem();
    if (!r) return;
    var pt = edPoint(e);
    var add = e.shiftKey || e.ctrlKey || e.metaKey;

    var hitSpot = -1, hitLayer = -1;
    r.design._spots.forEach(function (s, si) {
      var h = E.layerAt(s, pt.cx, pt.cy);
      if (h > -1) { hitSpot = si; hitLayer = h; }
    });

    if (hitSpot < 0) {
      /* Empty space: start pulling a selection box. */
      edMarquee = { x0: pt.fx, y0: pt.fy, x1: pt.fx, y1: pt.fy, add: add };
      el.bkEdMarquee.hidden = false;
      paintMarquee();
      return;
    }

    if (hitSpot !== edActive) { edActive = hitSpot; edPick = []; }
    if (add) {
      var at = edPick.indexOf(hitLayer);
      if (at > -1) edPick.splice(at, 1); else edPick.push(hitLayer);
      if (!edPick.length) edPick = [hitLayer];
    } else if (edPick.indexOf(hitLayer) < 0) {
      edPick = [hitLayer];
    }

    var s = edSpot();
    edGrab = {
      px: pt.px, py: pt.py, scale: s.scale || 1,
      start: s.layers.map(function (o) { return { dx: o.dx, dy: o.dy }; }),
      moving: movingSet()
    };
    edDragging = true;
    paintEditor();
  }

  /* Everything that should travel with this drag: the selection, plus any
     layer linked to something in it. */
  function movingSet() {
    var s = edSpot();
    var set = {};
    edPick.forEach(function (i) { set[i] = true; });
    var groups = {};
    edPick.forEach(function (i) { if (s.layers[i] && s.layers[i].group) groups[s.layers[i].group] = true; });
    s.layers.forEach(function (o, i) { if (o.group && groups[o.group]) set[i] = true; });
    return set;
  }

  function edMove(e) {
    var r = edItem();
    if (!r) return;

    if (edMarquee) {
      var m = edPoint(e);
      edMarquee.x1 = m.fx; edMarquee.y1 = m.fy;
      paintMarquee();
      return;
    }

    if (!edDragging || !edGrab) return;
    var s = edSpot();
    if (!s) return;
    if (e.cancelable) e.preventDefault();

    var pt = edPoint(e);
    var mx = (pt.px - edGrab.px) / edGrab.scale;
    var my = (pt.py - edGrab.py) / edGrab.scale;

    s.layers.forEach(function (o, i) {
      if (!edGrab.moving[i]) return;
      o.dx = edGrab.start[i].dx + mx;
      o.dy = edGrab.start[i].dy + my;
    });

    r.edited = true;
    edPaintCanvas();
  }

  function paintMarquee() {
    var box = el.bkEdCanvas.getBoundingClientRect();
    var stage = el.bkEdStage.getBoundingClientRect();
    var m = edMarquee;
    var x = Math.min(m.x0, m.x1) * box.width + (box.left - stage.left);
    var y = Math.min(m.y0, m.y1) * box.height + (box.top - stage.top);
    var w = Math.abs(m.x1 - m.x0) * box.width;
    var h = Math.abs(m.y1 - m.y0) * box.height;
    el.bkEdMarquee.style.left = x + 'px';
    el.bkEdMarquee.style.top = y + 'px';
    el.bkEdMarquee.style.width = w + 'px';
    el.bkEdMarquee.style.height = h + 'px';
  }

  function edEnd() {
    if (edMarquee) {
      var m = edMarquee;
      edMarquee = null;
      el.bkEdMarquee.hidden = true;

      var W = el.bkEdCanvas.width, H = el.bkEdCanvas.height;
      var x0 = Math.min(m.x0, m.x1) * W, x1 = Math.max(m.x0, m.x1) * W;
      var y0 = Math.min(m.y0, m.y1) * H, y1 = Math.max(m.y0, m.y1) * H;

      if (Math.abs(x1 - x0) > 6 && Math.abs(y1 - y0) > 6) {
        var r = edItem();
        var best = -1, hits = [];
        r.design._spots.forEach(function (s, si) {
          var got = (s._boxes || []).filter(function (b) {
            return b.x < x1 && b.x + b.w > x0 && b.y < y1 && b.y + b.h > y0;
          }).map(function (b) { return b.i; });
          if (got.length > hits.length) { hits = got; best = si; }
        });
        if (hits.length) {
          edActive = best;
          edPick = m.add ? edPick.concat(hits.filter(function (i) { return edPick.indexOf(i) < 0; })) : hits;
          paintEditor();
        }
      }
    }
    edDragging = false;
    edGrab = null;
  }

  /* ------------------------------------------------------------- aligning */

  function boxOf(i) {
    var s = edSpot();
    return (s._boxes || []).filter(function (b) { return b.i === i; })[0] || null;
  }

  function setCentre(L, cxPx, cyPx) {
    var s = edSpot();
    var R = edRect();
    var k = s.scale || 1;
    var SZ = E.SIZE;
    if (cxPx != null) L.dx = ((cxPx / SZ - R.x) / R.w - s.x) / k;
    if (cyPx != null) L.dy = ((cyPx / SZ - R.y) / R.h - s.y) / k;
  }

  function align(mode) {
    var r = edItem(), s = edSpot();
    if (!r || !s) return;

    var idx = edPick.length > 1 ? edPick.slice() : s.layers.map(function (_, i) { return i; });
    var boxes = idx.map(boxOf).filter(Boolean);
    if (boxes.length < 2 && mode !== 'centre') return;

    if (mode === 'centre') {
      edPick.forEach(function (i) { setCentre(s.layers[i], null, null); s.layers[i].dx = 0; });
      r.edited = true;
      paintEditor();
      return;
    }

    var minX = Math.min.apply(null, boxes.map(function (b) { return b.x; }));
    var maxX = Math.max.apply(null, boxes.map(function (b) { return b.x + b.w; }));
    var minY = Math.min.apply(null, boxes.map(function (b) { return b.y; }));
    var maxY = Math.max.apply(null, boxes.map(function (b) { return b.y + b.h; }));

    idx.forEach(function (i) {
      var b = boxOf(i);
      if (!b) return;
      var L = s.layers[i];
      if (mode === 'left')   setCentre(L, minX + b.w / 2, null);
      if (mode === 'right')  setCentre(L, maxX - b.w / 2, null);
      if (mode === 'cx')     setCentre(L, (minX + maxX) / 2, null);
      if (mode === 'top')    setCentre(L, null, minY + b.h / 2);
      if (mode === 'bottom') setCentre(L, null, maxY - b.h / 2);
      if (mode === 'cy')     setCentre(L, null, (minY + maxY) / 2);
    });

    r.edited = true;
    paintEditor();
  }

  /* Even vertical gaps, measured as a share of the average line height. */
  function spaceOut(pct) {
    var r = edItem(), s = edSpot();
    if (!r || !s) return;

    var idx = (edPick.length > 1 ? edPick.slice() : s.layers.map(function (_, i) { return i; }))
      .filter(function (i) { return boxOf(i); });
    if (idx.length < 2) return;

    idx.sort(function (a, b) { return boxOf(a).y - boxOf(b).y; });

    var avgH = idx.reduce(function (n, i) { return n + boxOf(i).h; }, 0) / idx.length;
    var gap = avgH * (pct / 100);

    var y = boxOf(idx[0]).y;
    idx.forEach(function (i, n) {
      var b = boxOf(i);
      if (n) setCentre(s.layers[i], null, y + b.h / 2);
      y += b.h + gap;
    });

    r.edited = true;
    edPaintCanvas();
  }

  /* --------------------------------------------------------------- output */

  function edCommit() {
    var r = edItem();
    if (!r) return Promise.resolve();
    r.design._showGuides = false;
    r.design._activeLayer = null;
    return renderResult(r).then(function () { renderResults(); });
  }

  function edStep(delta) {
    var next = edIndex + delta;
    if (next < 0 || next >= results.length) return;
    edCommit().then(function () { openEditor(next); });
  }

  function setColour(hex, live) {
    var r = edItem();
    if (!r) return;
    edSel().forEach(function (L) {
      if (L.kind === 'logo') { L.tint = hex; if (hex) L.recolour = null; }
      else L.ink = hex;
    });
    if (!live) { r.design.autoInk = false; r.edited = true; }
    edPaintCanvas();
  }

  function wireEditor() {
    el.bkEdClose.addEventListener('click', function () { edCommit().then(closeEditor); });
    el.bkEdDone.addEventListener('click', function () { edCommit().then(closeEditor); });
    el.bkEditor.addEventListener('click', function (e) {
      if (e.target === el.bkEditor) edCommit().then(closeEditor);
    });
    document.addEventListener('keydown', function (e) {
      if (el.bkEditor.hidden) return;
      if (e.key === 'Escape' && !document.querySelector('.xo-picker[style*="block"]')) {
        edCommit().then(closeEditor);
        return;
      }
      /* Arrow keys nudge, which is far easier than a careful drag. */
      var step = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
      if (step && document.activeElement && document.activeElement.tagName !== 'INPUT') {
        e.preventDefault();
        var r = edItem(), s = edSpot();
        if (!r || !s) return;
        var d = (e.shiftKey ? 0.02 : 0.004);
        var moving = movingSet();
        s.layers.forEach(function (L, i) {
          if (!moving[i]) return;
          L.dx += step[0] * d;
          L.dy += step[1] * d;
        });
        r.edited = true;
        edPaintCanvas();
      }
    });

    el.bkEdSelSize.addEventListener('input', function () {
      var r = edItem();
      if (!r) return;
      var pct = parseInt(el.bkEdSelSize.value, 10);
      el.bkEdSelSizeVal.textContent = pct + '%';
      edSel().forEach(function (L) { L.scale = pct / 100; });
      r.edited = true;
      edPaintCanvas();
    });

    el.bkEdSelText.addEventListener('input', function () {
      var r = edItem(), L = edOne();
      if (!r || !L || L.kind !== 'text') return;
      L.text = el.bkEdSelText.value;
      L.dir = E.isArabic(L.text) ? 'rtl' : 'ltr';
      L.font = E.fontFor(L.text);
      el.bkEdSelText.setAttribute('dir', L.dir);
      r.edited = true;
      edPaintCanvas();
      var row = XO.el('.bk-layer.is-active .bk-layer__t', el.bkEdLayers);
      if (row) row.textContent = layerLabel(L);
    });

    el.bkEdAdd.addEventListener('click', function () {
      var r = edItem(), s = edSpot();
      if (!r || !s) return;
      E.addTextLayer(s, 'New line');
      edPick = [s.layers.length - 1];
      r.edited = true;
      paintEditor();
      el.bkEdSelText.focus();
      el.bkEdSelText.select();
    });

    XO.els('.swatch', el.bkEdInk).forEach(function (b) {
      b.addEventListener('click', function () {
        setColour(b.getAttribute('data-hex'), false);
        paintSelected();
      });
    });

    el.bkEdOriginal.addEventListener('click', function () {
      var L = edOne();
      if (L) { L.tint = null; L.recolour = null; }
      var r = edItem();
      if (r) r.edited = true;
      paintSelected();
      edPaintCanvas();
    });

    el.bkEdPick.addEventListener('click', function () {
      var L = edOne();
      if (!L) return;
      var was = L.kind === 'logo' ? L.tint : L.ink;
      XOColour.open({
        hex: was || '#FFFFFF',
        trigger: el.bkEdPick,
        onChange: function (hex) { setColour(hex, true); },
        onDone: function (hex) { setColour(hex, false); paintSelected(); }
      });
    });

    XO.els('button', el.bkEdAlign).forEach(function (b) {
      b.addEventListener('click', function () { align(b.getAttribute('data-al')); });
    });

    el.bkEdGap.addEventListener('input', function () {
      var pct = parseInt(el.bkEdGap.value, 10);
      el.bkEdGapVal.textContent = pct + '%';
      spaceOut(pct);
    });

    XO.els('button', el.bkEdLayout).forEach(function (b) {
      b.addEventListener('click', function () {
        var r = edItem(), s = edSpot();
        if (!r || !s) return;
        s.layout = b.getAttribute('data-lay');
        s.layers = null;
        s._layoutKey = null;
        edPick = [0];
        r.edited = true;
        paintEditor();
      });
    });

    el.bkEdAuto.addEventListener('click', function () {
      var r = edItem();
      if (!r) return;
      r.design.autoInk = true;
      applyInk(r.img, r.design);
      r.design._spots.forEach(function (s) {
        (s.layers || []).forEach(function (L) {
          if (L.kind === 'text') L.ink = null; else { L.tint = null; L.recolour = null; }
        });
      });
      r.edited = true;
      paintEditor();
    });

    el.bkEdReset.addEventListener('click', function () {
      var r = edItem();
      if (!r) return;
      r.design = freshDesign(r.img, r.analysis);
      r.edited = false;
      edActive = 0;
      edPick = [0];
      paintEditor();
    });

    el.bkEdPrev.addEventListener('click', function () { edStep(-1); });
    el.bkEdNext.addEventListener('click', function () { edStep(1); });

    el.bkEdCanvas.addEventListener('mousedown', edStart);
    el.bkEdCanvas.addEventListener('touchstart', edStart, { passive: true });
    window.addEventListener('mousemove', edMove);
    window.addEventListener('touchmove', edMove, { passive: false });
    window.addEventListener('mouseup', edEnd);
    window.addEventListener('touchend', edEnd);
  }

  function renderResults() {
    if (!results.length) { el.bkOutWrap.hidden = true; return; }
    el.bkOutWrap.hidden = false;

    el.bkOut.innerHTML = results.map(function (r, i) {
      return '<div class="bk-out__item' + (r.on ? ' is-on' : '') + '" data-i="' + i + '">' +
        '<label class="bk-out__tick"><input type="checkbox"' + (r.on ? ' checked' : '') +
          ' aria-label="Include ' + XO.esc(r.title) + '"></label>' +
        (r.edited ? '<span class="bk-out__flag">edited</span>' : '') +
        '<button type="button" class="bk-out__shot" data-edit="' + i + '" ' +
          'aria-label="Edit ' + XO.esc(r.title) + '">' +
          '<img src="' + r.url + '" alt="">' +
          '<span class="bk-out__pen"><i class="fa-solid fa-sliders"></i> Adjust</span>' +
        '</button>' +
        '<span class="bk-out__t">' + XO.esc(r.title) + '</span>' +
        '<span class="bk-out__s">' + fmtBytes(r.png.length) + '</span>' +
      '</div>';
    }).join('');

    XO.els('.bk-out__item', el.bkOut).forEach(function (box) {
      var i = parseInt(box.getAttribute('data-i'), 10);
      XO.el('input', box).addEventListener('change', function (e) {
        results[i].on = e.target.checked;
        box.classList.toggle('is-on', e.target.checked);
      });
      XO.el('[data-edit]', box).addEventListener('click', function () { openEditor(i); });
    });
  }

  function setAllResults(on) {
    results.forEach(function (r) { r.on = on; });
    renderResults();
  }

  function chosen() {
    return results.filter(function (r) { return r.on; });
  }

  /* =======================================================================
     Downloads
     ======================================================================= */

  function folderName() {
    return safeName(S.company) + ' - branded workwear';
  }

  function detailsText() {
    var l = [];
    l.push('Xpertone Creative LLC-FZ — branded workwear');
    l.push('');
    l.push('Client:        ' + (S.company || '-'));
    if (S.companyAr) l.push('Arabic name:   ' + S.companyAr);
    if (S.contact) l.push('Contact:       ' + S.contact);
    if (S.phone) l.push('Number:        ' + S.phone);
    l.push('Prepared:      ' + today());
    l.push('');
    l.push('Print:         chest and full back' + (S.sleeves ? ' and both sleeves' : ''));
    l.push('Print colour:  ' + S.colour);
    if (S.logoName) l.push('Logo file:     ' + S.logoName + (S.removedBg ? ' (background removed)' : ''));
    l.push('');
    l.push('Items in this folder:');
    chosen().forEach(function (r, i) {
      l.push('  ' + pad2(i + 1) + '. ' + r.title + '  —  ' +
        XO.money(r.price, true) + ' per piece, ex VAT');
    });
    l.push('');
    l.push('Prices exclude 5% VAT. Minimum ' + CFG.MOQ + ' pieces per item.');
    l.push('Volume pricing: ' + (CFG.PRICE_TIERS || []).map(function (t) {
      return t.min + '+ = ' + Math.round(t.discount * 100) + '% off';
    }).join(', ') + '.');
    l.push('');
    l.push(CFG.COMPANY.name + ' · ' + CFG.COMPANY.phone + ' · ' + CFG.COMPANY.email);
    l.push(CFG.COMPANY.address);
    return l.join('\r\n');
  }

  function downloadZip() {
    var list = chosen();
    if (!list.length) { XO.toast('Tick at least one item', 'fa-triangle-exclamation'); return; }

    var folder = folderName();
    var files = list.map(function (r, i) {
      return { name: folder + '/' + pad2(i + 1) + ' ' + safeName(r.title) + '.png', data: r.png };
    });
    files.push({ name: folder + '/details.txt', data: XOPack.utf8(detailsText()) });
    if (S.logo) {
      files.push({ name: folder + '/logo (cleaned up).png', data: dataUrlToU8(S.logo) });
    }
    if (S.logo2) {
      files.push({ name: folder + '/logo 2 (cleaned up).png', data: dataUrlToU8(S.logo2) });
    }

    XOPack.download(XOPack.zip(files), folder + '.zip');
    XO.toast(list.length + ' images packed', 'fa-folder-open');
  }

  function downloadPdf() {
    var list = chosen();
    if (!list.length) { XO.toast('Tick at least one item', 'fa-triangle-exclamation'); return; }

    var pages = list.map(function (r) {
      var lines = [];
      lines.push(XO.money(r.price, true) + ' per piece, excluding VAT');
      if (r.sizes && r.sizes.length) lines.push('Sizes: ' + r.sizes.join(', '));
      lines.push('Printed on the chest and across the back' + (S.sleeves ? ', and on both sleeves' : ''));
      return { jpeg: r.jpeg, w: r.w, h: r.h, title: r.title, lines: lines };
    });

    var blob = XOPack.pdf(pages, {
      company: S.company || 'Branded workwear',
      subhead: [S.contact, S.phone].filter(Boolean).join('  ·  ') || CFG.COMPANY.phone,
      title: safeName(S.company) + ' — branded workwear',
      footer: CFG.COMPANY.name + '  ·  ' + CFG.COMPANY.phone + '  ·  prices exclude 5% VAT'
    });

    XOPack.download(blob, folderName() + '.pdf');
    XO.toast(list.length + '-page catalogue ready', 'fa-file-pdf');
  }

  function dataUrlToU8(url) {
    var bin = atob(url.split(',')[1]);
    var u8 = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    return u8;
  }

  function whatsapp() {
    var list = chosen();
    var l = ['Hello' + (S.contact ? ' ' + S.contact : '') + ',', ''];
    l.push('Here is your workwear branded with your logo' +
      (S.company ? ' for ' + S.company : '') + ':');
    l.push('');
    list.forEach(function (r) {
      l.push('• ' + r.title + ' — ' + XO.money(r.price, true) + ' per piece (ex VAT)');
    });
    l.push('');
    l.push('Printed on the chest and across the back' + (S.sleeves ? ', and on both sleeves' : '') + '.');
    l.push('Minimum ' + CFG.MOQ + ' pieces per item. ' +
      (CFG.PRICE_TIERS || []).map(function (t) {
        return t.min + '+ pieces = ' + Math.round(t.discount * 100) + '% off';
      }).join(', ') + '.');
    l.push('');
    l.push(CFG.COMPANY.name + ' — ' + CFG.COMPANY.phone);

    var msg = l.join('\n');
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(msg).then(function () {
        XO.toast('Message copied — paste it with the folder', 'fa-clipboard-check');
      }, function () {});
    }
    var num = (S.phone || '').replace(/[^0-9]/g, '');
    if (num.length >= 9) {
      if (num.charAt(0) === '0') num = '971' + num.slice(1);
      window.open('https://wa.me/' + num + '?text=' + encodeURIComponent(msg), '_blank', 'noopener');
    } else {
      window.open(XO.waLink(msg), '_blank', 'noopener');
    }
  }

  /* =======================================================================
     Saving, listing, export and import
     ======================================================================= */

  function toRecord() {
    return {
      id: S.id || newId(),
      company: S.company, companyAr: S.companyAr, phone: S.phone,
      contact: S.contact, notes: S.notes,
      colour: S.colour, sleeves: S.sleeves, autoInk: S.autoInk,
      cut: S.cut, tolerance: S.tolerance, target: S.target, sharpAmount: S.sharpAmount,
      logo: S.logo, logoName: S.logoName, logoPx: S.logoPx, removedBg: S.removedBg,
      logo2: S.logo2, logo2Name: S.logo2Name, twoLogos: S.twoLogos, backLogo2: S.backLogo2,
      picks: Object.keys(S.picks).filter(function (k) { return S.picks[k]; })
    };
  }

  function saveCurrent() {
    if (!S.company.trim() && !S.phone.trim()) {
      XO.toast('Add a company name or a number first', 'fa-triangle-exclamation');
      return;
    }
    var rec = toRecord();
    var r = Clients.save(rec);
    if (!r.ok) {
      el.bkSaveNote.innerHTML = '<span class="bk-bad">This browser is out of room. ' +
        'Export your clients to a file, then delete a few old ones.</span>';
      return;
    }
    S.id = rec.id;
    S.dirty = false;
    el.bkDelete.hidden = false;
    el.bkSaveNote.innerHTML = r.reason === 'trimmed'
      ? '<span class="bk-warn">Saved. Storage was tight, so the logo on an older client was dropped.</span>'
      : '<span class="bk-good">Saved ' + new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) + '</span>';
    renderClients();
  }

  function deleteCurrent() {
    if (!S.id) return;
    if (!window.confirm('Delete ' + (S.company || 'this client') + '? This cannot be undone.')) return;
    Clients.remove(S.id);
    reset();
    XO.toast('Client deleted', 'fa-trash-can');
  }

  function loadClient(id) {
    var c = Clients.get(id);
    if (!c) return;
    S.id = c.id;
    S.company = c.company || ''; S.companyAr = c.companyAr || '';
    S.phone = c.phone || ''; S.contact = c.contact || ''; S.notes = c.notes || '';
    S.colour = c.colour || S.colour;
    S.sleeves = !!c.sleeves;
    S.autoInk = c.autoInk !== false;
    S.cut = c.cut !== false;
    S.tolerance = c.tolerance || S.tolerance;
    S.target = typeof c.target === 'number' ? c.target : S.target;
    S.sharpAmount = typeof c.sharpAmount === 'number' ? c.sharpAmount : S.sharpAmount;
    S.logo = c.logo || ''; S.logoName = c.logoName || ''; S.logoPx = c.logoPx || 0;
    S.removedBg = !!c.removedBg;
    S.logo2 = c.logo2 || ''; S.logo2Name = c.logo2Name || '';
    S.twoLogos = !!c.twoLogos; S.backLogo2 = !!c.backLogo2;
    logoImg2 = null; rawFileImage2 = null;
    S.dirty = false;
    rawFileImage = null;
    logoImg = null;

    if (Array.isArray(c.picks) && c.picks.length) {
      S.picks = {};
      c.picks.forEach(function (u) { S.picks[u] = true; });
    }

    clearResults();
    paintState();
    renderPicks();
    renderClients();

    if (S.logo2) {
      E.loadImage(S.logo2, false).then(function (li) { logoImg2 = li; });
    }
    if (S.logo) {
      E.loadImage(S.logo, false).then(function (li) {
        logoImg = li;
        el.bkNote.innerHTML = '<span class="bk-good"><i class="fa-solid fa-circle-check"></i> ' +
          'Logo loaded from the saved record. Upload a new file to change it.</span>';
      });
    }
    XO.toast('Opened ' + (S.company || 'client'), 'fa-folder-open');
  }

  function renderClients() {
    var q = (el.bkSearch.value || '').toLowerCase().trim();
    var list = Clients.all().filter(function (c) {
      if (!q) return true;
      return (c.company || '').toLowerCase().indexOf(q) > -1 ||
             (c.phone || '').toLowerCase().indexOf(q) > -1 ||
             (c.contact || '').toLowerCase().indexOf(q) > -1;
    });

    el.bkList.innerHTML = list.length
      ? list.map(function (c) {
          return '<button type="button" class="bk-client' + (c.id === S.id ? ' is-active' : '') +
            '" data-id="' + XO.esc(c.id) + '">' +
            '<span class="bk-client__logo">' + (c.logo
              ? '<img src="' + c.logo + '" alt="">'
              : '<i class="fa-solid fa-building"></i>') + '</span>' +
            '<span class="bk-client__body">' +
              '<b>' + XO.esc(c.company || 'Unnamed client') + '</b>' +
              '<span>' + XO.esc(c.phone || c.contact || '') + '</span>' +
            '</span></button>';
        }).join('')
      : '<p class="bk-hint mb-0">' + (q ? 'No match.' : 'No clients saved yet.') + '</p>';

    XO.els('.bk-client', el.bkList).forEach(function (b) {
      b.addEventListener('click', function () {
        if (S.dirty && !window.confirm('You have unsaved changes. Open this client anyway?')) return;
        loadClient(b.getAttribute('data-id'));
      });
    });

    var u = Clients.usage();
    el.bkStorage.innerHTML = Clients.all().length + ' saved · ' + fmtBytes(u.bytes) +
      ' used<div class="bk-meter"><span style="width:' + u.pct + '%"></span></div>';
  }

  /* A plain spreadsheet of the client list - the thing a salesperson can
     actually open, sort and send on. The backup file stays JSON because it
     has to carry the logos and be loadable again. */
  function exportExcel() {
    var list = Clients.all();
    if (!list.length) { XO.toast('No clients saved yet', 'fa-triangle-exclamation'); return; }

    var byUid = {};
    products.forEach(function (p) { byUid[p.uid] = p.title; });

    var rows = [[
      'Company', 'Company (Arabic)', 'Contact person', 'Number', 'Note',
      'Print colour', 'Sleeves', 'Second logo', 'Items chosen', 'Item list',
      'Logo on file', 'Added', 'Last updated'
    ]];

    list.forEach(function (c) {
      var picks = Array.isArray(c.picks) ? c.picks : [];
      rows.push([
        c.company || '',
        c.companyAr || '',
        c.contact || '',
        c.phone || '',
        c.notes || '',
        c.colour || '',
        c.sleeves ? 'Yes' : 'No',
        c.twoLogos ? 'Yes' : 'No',
        picks.length,
        picks.map(function (u) { return byUid[u] || u; }).join(', '),
        c.logo ? (c.logoName || 'yes') : 'no',
        (c.created || '').slice(0, 10),
        (c.updated || '').slice(0, 10)
      ]);
    });

    var blob = XOPack.xlsx([{
      name: 'Clients',
      widths: [30, 24, 18, 16, 34, 13, 9, 11, 12, 60, 20, 12, 13],
      rows: rows
    }]);

    XOPack.download(blob, 'xpertone-clients-' + today() + '.xlsx');
    XO.toast(list.length + ' clients exported to Excel', 'fa-file-excel');
  }

  function exportAll() {
    var payload = {
      format: 'xpertone-clients',
      version: 1,
      exported: new Date().toISOString(),
      clients: Clients.all()
    };
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    XOPack.download(blob, 'xpertone-clients-backup-' + today() + '.json');
    XO.toast('Backup downloaded', 'fa-cloud-arrow-down');
  }

  function importFile(file) {
    var reader = new FileReader();
    reader.onload = function () {
      var data;
      try { data = JSON.parse(reader.result); }
      catch (e) { XO.toast('That file could not be read', 'fa-triangle-exclamation'); return; }

      var incoming = Array.isArray(data) ? data : (data.clients || []);
      if (!incoming.length) { XO.toast('No clients in that file', 'fa-triangle-exclamation'); return; }

      var mine = Clients.all();
      var byId = {};
      mine.forEach(function (c) { byId[c.id] = c; });

      var added = 0, updated = 0;
      incoming.forEach(function (c) {
        if (!c || !c.id) return;
        if (byId[c.id]) {
          /* Keep whichever copy was touched last. */
          if (String(c.updated || '') > String(byId[c.id].updated || '')) {
            mine[mine.indexOf(byId[c.id])] = c;
            updated++;
          }
        } else { mine.unshift(c); added++; }
      });

      if (!Clients._write(mine)) {
        XO.toast('Not enough room in this browser for all of them', 'fa-triangle-exclamation');
      } else {
        XO.toast(added + ' added, ' + updated + ' updated', 'fa-file-import');
      }
      el.bkImport.value = '';
      renderClients();
    };
    reader.readAsText(file);
  }

  /* ===================================================================== */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else { boot(); }
})();
