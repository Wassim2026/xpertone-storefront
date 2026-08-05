/* =========================================================================
   XpertOne Prints — Product designer
   -------------------------------------------------------------------------
   Lets the customer put their own logo and text onto a product before it
   goes in the cart, and see exactly how it will look.

     - upload a logo, background removed automatically in the browser
     - type the text in English and in Arabic
     - drag the print where they want it, and size it
     - pick the ink colour from a swatch
     - see it composited onto the real product photo, live

   The finished mockup is stored with the cart line, shown again in the cart
   and at checkout, and sent to sales as an image so the design the customer
   approved is the design that gets printed.

   Exposes:
     Designs         — per-cart-line design storage (localStorage)
     ProductDesigner — the customiser UI, mounted on the product page
     DesignSheet     — combines every design in the cart into one image
   ========================================================================= */

(function () {
  'use strict';

  var CFG = window.XO_CONFIG;
  var KEY = 'xo_designs_v1';

  /* =======================================================================
     Storage — keyed by cart line key, so a design follows its line
     ======================================================================= */
  var Designs = window.Designs = {

    all: function () {
      try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; }
      catch (e) { return {}; }
    },

    get: function (key) { return this.all()[key] || null; },

    set: function (key, design) {
      var all = this.all();
      all[key] = design;
      try {
        localStorage.setItem(KEY, JSON.stringify(all));
      } catch (e) {
        /* Storage is full. Drop the mockups of older designs — the details
           and the logo matter more than the picture. */
        Object.keys(all).forEach(function (k) { if (k !== key) delete all[k].mockup; });
        try { localStorage.setItem(KEY, JSON.stringify(all)); } catch (e2) {}
      }
      return design;
    },

    remove: function (key) {
      var all = this.all();
      delete all[key];
      try { localStorage.setItem(KEY, JSON.stringify(all)); } catch (e) {}
    },

    /* Drop designs whose cart line no longer exists. */
    prune: function () {
      if (!window.Cart) return;
      var live = {};
      Cart.lines().forEach(function (l) { live[l.key] = 1; });
      var all = this.all(), changed = false;
      Object.keys(all).forEach(function (k) {
        if (!live[k]) { delete all[k]; changed = true; }
      });
      if (changed) { try { localStorage.setItem(KEY, JSON.stringify(all)); } catch (e) {} }
    },

    clear: function () { try { localStorage.removeItem(KEY); } catch (e) {} },

    /* One-line description used in the order email and the WhatsApp copy. */
    describe: function (d) {
      if (!d) return '';
      var bits = [];
      var rows = (d.lines && d.lines.length) ? d.lines : [d.en, d.ar].filter(Boolean);
      if (rows.length) bits.push('Text: ' + rows.map(function (r) { return '"' + r + '"'; }).join(' / '));
      if (d.logoName) bits.push('Logo: ' + d.logoName + (d.removedBg ? ' (background removed)' : ''));
      if (d.placement) bits.push('Placement: ' + d.placement);
      if (d.colour) bits.push('Print colour: ' + d.colour);
      return bits.join(' | ');
    }
  };

  /* =======================================================================
     Background removal
     -----------------------------------------------------------------------
     Flood-fills inwards from the edges and clears every pixel that matches
     the border colour within a tolerance. Working from the edges rather than
     removing every white pixel means white inside a letter or inside the
     logo itself is kept.
     ======================================================================= */
  function removeBackground(source, tolerance) {
    var w = source.width, h = source.height;
    var cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    var ctx = cv.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(source, 0, 0, w, h);

    var img, data;
    try { img = ctx.getImageData(0, 0, w, h); data = img.data; }
    catch (e) { return { canvas: cv, removed: 0 }; }

    /* Seed colour: average of the four corners. */
    var corners = [0, (w - 1) * 4, (h - 1) * w * 4, ((h - 1) * w + w - 1) * 4];
    var sr = 0, sg = 0, sb = 0;
    corners.forEach(function (i) { sr += data[i]; sg += data[i + 1]; sb += data[i + 2]; });
    sr /= 4; sg /= 4; sb /= 4;

    var tol = (tolerance == null ? 40 : tolerance);
    var tolSq = tol * tol * 3;

    function matches(i) {
      if (data[i + 3] === 0) return true;
      var dr = data[i] - sr, dg = data[i + 1] - sg, db = data[i + 2] - sb;
      return (dr * dr + dg * dg + db * db) <= tolSq;
    }

    /* Iterative flood fill from every border pixel. */
    var seen = new Uint8Array(w * h);
    var stack = [];
    var x, y;
    for (x = 0; x < w; x++) { stack.push(x); stack.push(x + (h - 1) * w); }
    for (y = 0; y < h; y++) { stack.push(y * w); stack.push(y * w + w - 1); }

    var removed = 0;
    while (stack.length) {
      var p = stack.pop();
      if (p < 0 || p >= w * h || seen[p]) continue;
      seen[p] = 1;
      var i4 = p * 4;
      if (!matches(i4)) continue;
      if (data[i4 + 3] !== 0) { data[i4 + 3] = 0; removed++; }
      var px = p % w, py = (p / w) | 0;
      if (px > 0) stack.push(p - 1);
      if (px < w - 1) stack.push(p + 1);
      if (py > 0) stack.push(p - w);
      if (py < h - 1) stack.push(p + w);
    }

    /* Soften the cut edge so it does not look like a paper cut-out. */
    for (y = 1; y < h - 1; y++) {
      for (x = 1; x < w - 1; x++) {
        var idx = (y * w + x) * 4;
        if (data[idx + 3] === 0) continue;
        var clear = 0;
        if (data[idx - 4 + 3] === 0) clear++;
        if (data[idx + 4 + 3] === 0) clear++;
        if (data[idx - w * 4 + 3] === 0) clear++;
        if (data[idx + w * 4 + 3] === 0) clear++;
        if (clear >= 2) data[idx + 3] = Math.min(data[idx + 3], 140);
      }
    }

    ctx.putImageData(img, 0, 0);
    return { canvas: cv, removed: removed / (w * h) };
  }

  /* Crop away fully transparent margins so the logo scales predictably. */
  function trim(cv) {
    var ctx = cv.getContext('2d', { willReadFrequently: true });
    var w = cv.width, h = cv.height, d;
    try { d = ctx.getImageData(0, 0, w, h).data; } catch (e) { return cv; }

    var minX = w, minY = h, maxX = -1, maxY = -1;
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        if (d[(y * w + x) * 4 + 3] > 12) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < 0) return cv;

    var pad = 2;
    minX = Math.max(0, minX - pad); minY = Math.max(0, minY - pad);
    maxX = Math.min(w - 1, maxX + pad); maxY = Math.min(h - 1, maxY + pad);

    var out = document.createElement('canvas');
    out.width = maxX - minX + 1;
    out.height = maxY - minY + 1;
    out.getContext('2d').drawImage(cv, minX, minY, out.width, out.height, 0, 0, out.width, out.height);
    return out;
  }

  function downscale(source, maxSide) {
    var w = source.width, h = source.height;
    var scale = Math.min(1, maxSide / Math.max(w, h));
    if (scale === 1) return source;
    var cv = document.createElement('canvas');
    cv.width = Math.round(w * scale);
    cv.height = Math.round(h * scale);
    var ctx = cv.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(source, 0, 0, cv.width, cv.height);
    return cv;
  }

  function loadImage(src, crossOrigin) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      if (crossOrigin) img.crossOrigin = 'anonymous';
      img.onload = function () { resolve(img); };
      img.onerror = function () { reject(new Error('Could not load image')); };
      img.src = src;
    });
  }

  var ARABIC = /[؀-ۿݐ-ݿ]/;

  function isArabic(s) { return ARABIC.test(s || ''); }

  /* A design carries an array of rows. Older saved designs used separate
     English and Arabic fields, so fall back to those. */
  function linesOf(design) {
    var rows = design.lines || [];
    if (!rows.length) rows = [design.en, design.ar];
    return rows.map(function (r) { return (r || '').trim(); }).filter(Boolean);
  }

  /* =======================================================================
     Photo analysis
     -----------------------------------------------------------------------
     Finds the garment in the product photo so prints can be positioned
     against the garment itself rather than the edges of the image. A photo
     showing a front and a back view gives two blobs; a helmet gives one.
     Everything downstream works in fractions of a blob, so the print lands
     correctly whatever the photo looks like.
     ======================================================================= */
  function analysePhoto(img) {
    var W = 180;
    var H = Math.max(1, Math.round(img.height * (W / img.width)));
    var cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    var ctx = cv.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, W, H);

    var d;
    try { d = ctx.getImageData(0, 0, W, H).data; }
    catch (e) { return { blobs: [{ x: 0, y: 0, w: 1, h: 1 }] }; }

    var c = [0, (W - 1) * 4, (H - 1) * W * 4, ((H - 1) * W + W - 1) * 4];
    var br = 0, bg = 0, bb = 0;
    c.forEach(function (i) { br += d[i]; bg += d[i + 1]; bb += d[i + 2]; });
    br /= 4; bg /= 4; bb /= 4;

    function isSubject(i) {
      if (d[i + 3] < 24) return false;
      var dr = d[i] - br, dg = d[i + 1] - bg, db = d[i + 2] - bb;
      return (dr * dr + dg * dg + db * db) > 2400;
    }

    var colCount = new Array(W).fill(0);
    var x, y;
    for (y = 0; y < H; y++) {
      for (x = 0; x < W; x++) {
        if (isSubject((y * W + x) * 4)) colCount[x]++;
      }
    }

    var floor = Math.max(2, H * 0.06);
    var gap = Math.max(4, W * 0.035);
    var runs = [], run = null, lastOn = -1;
    for (x = 0; x < W; x++) {
      if (colCount[x] > floor) {
        if (!run) { run = { a: x, b: x }; runs.push(run); }
        run.b = x;
        lastOn = x;
      } else if (run && (x - lastOn) > gap) {
        /* Far enough past the last column of subject to call this the end of
           a view. Narrower breaks are just a strap or a gap in the print. */
        run = null;
      }
    }
    runs = runs.filter(function (r) { return (r.b - r.a) > W * 0.08; });
    if (!runs.length) return { blobs: [{ x: 0, y: 0, w: 1, h: 1 }] };

    /* Front and back views often sit close enough that they read as one
       shape. If a single run is wide, look for the thin valley between the
       two garments and split there. */
    if (runs.length === 1 && (runs[0].b - runs[0].a) > W * 0.5) {
      var r0 = runs[0];
      var mid = -1, lowest = Infinity, mean = 0, n = 0;
      for (x = r0.a; x <= r0.b; x++) { mean += colCount[x]; n++; }
      mean = mean / Math.max(1, n);
      var from = Math.round(r0.a + (r0.b - r0.a) * 0.34);
      var to = Math.round(r0.a + (r0.b - r0.a) * 0.66);
      for (x = from; x <= to; x++) {
        if (colCount[x] < lowest) { lowest = colCount[x]; mid = x; }
      }
      if (mid > 0 && lowest < mean * 0.45) {
        runs = [{ a: r0.a, b: mid - 1 }, { a: mid + 1, b: r0.b }];
      }
    }
    if (runs.length > 2) {
      runs.sort(function (a, b) { return (b.b - b.a) - (a.b - a.a); });
      runs = runs.slice(0, 2).sort(function (a, b) { return a.a - b.a; });
    }

    var blobs = runs.map(function (r) {
      var top = H, bottom = 0;
      for (y = 0; y < H; y++) {
        for (x = r.a; x <= r.b; x++) {
          if (isSubject((y * W + x) * 4)) {
            if (y < top) top = y;
            if (y > bottom) bottom = y;
            break;
          }
        }
      }
      if (bottom < top) { top = 0; bottom = H - 1; }
      return { x: r.a / W, y: top / H, w: (r.b - r.a + 1) / W, h: (bottom - top + 1) / H };
    });

    return { blobs: blobs };
  }

  /* =======================================================================
     Logo clean-up
     -----------------------------------------------------------------------
     Most logos arrive over WhatsApp, which means small and soft. Upscaling
     in steps and sharpening afterwards will not invent detail, but it stops
     the print looking like a screenshot of a screenshot.
     ======================================================================= */
  function sharpen(cv, amount) {
    if (!amount) return cv;
    var ctx = cv.getContext('2d', { willReadFrequently: true });
    var w = cv.width, h = cv.height, img;
    try { img = ctx.getImageData(0, 0, w, h); } catch (e) { return cv; }
    var src = new Uint8ClampedArray(img.data);
    var d = img.data;

    for (var y = 1; y < h - 1; y++) {
      for (var x = 1; x < w - 1; x++) {
        var i = (y * w + x) * 4;
        for (var ch = 0; ch < 3; ch++) {
          var centre = src[i + ch];
          var around = (src[i - 4 + ch] + src[i + 4 + ch] +
                        src[i - w * 4 + ch] + src[i + w * 4 + ch]) / 4;
          d[i + ch] = centre + (centre - around) * amount;
        }
      }
    }
    ctx.putImageData(img, 0, 0);
    return cv;
  }

  /* Steps up in halves rather than one jump, which keeps edges cleaner. */
  function upscale(source, targetSide) {
    var cur = source, guard = 0;
    while (Math.max(cur.width, cur.height) < targetSide && guard++ < 4) {
      var factor = Math.min(2, targetSide / Math.max(cur.width, cur.height));
      var cv = document.createElement('canvas');
      cv.width = Math.round(cur.width * factor);
      cv.height = Math.round(cur.height * factor);
      var ctx = cv.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(cur, 0, 0, cv.width, cv.height);
      cur = cv;
    }
    return cur;
  }

  /* =======================================================================
     Mockup rendering
     ======================================================================= */
  var SIZE = 760;

  /* A product photo either shows one view or a front and a back side by side.
     Which one decides where "full back" actually is. */
  function layoutFor(product) {
    var L = (CFG.PRINTING.layouts || {});
    return L[product.category] || 'single';
  }

  /* Placements are described against a view — "chest" is a third of the way
     across the front view and 30% down it. Combined with the blobs found in
     the photo, that puts the print in the right place automatically, on any
     product, with no hand-tuned coordinates. */
  function spotsFor(placement, analysis) {
    var recipes = CFG.PRINTING.spots || {};
    var list = recipes[placement] || recipes._default ||
      [{ view: 0, rx: 0.5, ry: 0.42, rw: 0.5, label: 'Print' }];
    var blobs = (analysis && analysis.blobs && analysis.blobs.length)
      ? analysis.blobs : [{ x: 0, y: 0, w: 1, h: 1 }];

    return list.map(function (s) {
      /* A photo with only one view still honours a "back" print — it simply
         lands on the view that is there. */
      var b = blobs[Math.min(s.view, blobs.length - 1)];
      return {
        x: b.x + b.w * s.rx,
        y: b.y + b.h * s.ry,
        w: b.w * s.rw,
        hMax: b.h * (s.rh || 0.40),
        rows: s.rows,
        label: s.label || 'Print',
        scale: 1
      };
    });
  }

  /* Draws one print — logo, English line, Arabic line — inside a spot. */
  function drawPrint(ctx, design, spot, highlight) {
    var cx = SIZE * spot.x;
    var maxW = SIZE * spot.w * (spot.scale || 1);
    var parts = [];

    if (design._logoImg) {
      var li = design._logoImg;
      var ls = maxW / li.width;
      parts.push({ type: 'logo', img: li, w: maxW, h: li.height * ls });
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    function fit(text, font, dir) {
      var px = Math.max(9, Math.round(maxW * 0.19));
      ctx.direction = dir;
      while (px > 7) {
        ctx.font = '700 ' + px + 'px ' + font;
        if (ctx.measureText(text).width <= maxW) break;
        px -= 1;
      }
      return px;
    }

    /* Each row is typed on its own line and sized to fit on its own, so a
       long company name and a short phone number both look deliberate. */
    /* A chest badge or a sleeve has room for far less than a full back. The
       recipe says how many rows belong there, so a long company name never
       shrinks to something unreadable just to fit. */
    var rows = linesOf(design);
    if (typeof spot.rows === 'number') {
      rows = rows.slice(0, design._logoImg ? spot.rows : Math.max(1, spot.rows));
    }

    rows.forEach(function (line) {
      var rtl = isArabic(line);
      var font = rtl
        ? "'Noto Sans Arabic', 'Segoe UI', Tahoma, Arial, sans-serif"
        : "'Inter', Arial, sans-serif";
      parts.push({
        type: 'text', text: line, font: font,
        dir: rtl ? 'rtl' : 'ltr', px: fit(line, font, rtl ? 'rtl' : 'ltr')
      });
    });
    if (!parts.length) return null;

    var gap = maxW * 0.06;
    function measure() {
      return parts.reduce(function (n, p, i) {
        return n + (p.type === 'logo' ? p.h : p.px * 1.15) + (i ? gap : 0);
      }, 0);
    }
    var total = measure();

    /* Keep the whole print inside the panel it sits on. A logo plus three
       rows of text would otherwise run off the garment. */
    var hMax = SIZE * (spot.hMax || 0.4) * (spot.scale || 1);
    if (total > hMax) {
      var k = hMax / total;
      parts.forEach(function (p) {
        if (p.type === 'logo') { p.w *= k; p.h *= k; }
        else p.px = Math.max(7, p.px * k);
      });
      gap *= k;
      total = measure();
    }

    var y = SIZE * spot.y - total / 2;
    var top = y;

    parts.forEach(function (p, i) {
      if (i) y += gap;
      if (p.type === 'logo') {
        ctx.drawImage(p.img, cx - p.w / 2, y, p.w, p.h);
        y += p.h;
      } else {
        ctx.fillStyle = design.inkColour || '#111111';
        ctx.font = '700 ' + Math.round(p.px) + 'px ' + p.font;
        ctx.direction = p.dir;
        ctx.fillText(p.text, cx, y);
        y += p.px * 1.15;
      }
    });
    ctx.direction = 'ltr';

    var drawnW = parts.reduce(function (n, p) {
      return Math.max(n, p.type === 'logo' ? p.w : ctx.measureText(p.text).width);
    }, maxW * 0.2);
    var box = { x: cx - drawnW / 2, y: top, w: drawnW, h: y - top };

    if (highlight) {
      var m = maxW * 0.12;
      ctx.save();
      ctx.strokeStyle = '#FFB800';
      ctx.lineWidth = 2;
      ctx.setLineDash([7, 5]);
      ctx.strokeRect(box.x - m, box.y - m, box.w + m * 2, box.h + m * 2);
      ctx.setLineDash([]);
      ctx.fillStyle = '#FFB800';
      ctx.font = "700 15px 'Inter', Arial, sans-serif";
      ctx.textAlign = 'left';
      ctx.fillText(spot.label, box.x - m, box.y - m - 8);
      ctx.restore();
    }
    return box;
  }

  function drawMockup(canvas, productImg, design) {
    var ctx = canvas.getContext('2d');
    canvas.width = SIZE;
    canvas.height = SIZE;

    ctx.fillStyle = '#F6F7F9';
    ctx.fillRect(0, 0, SIZE, SIZE);

    var pad = SIZE * 0.03;
    var box = SIZE - pad * 2;
    var s = Math.min(box / productImg.width, box / productImg.height);
    var pw = productImg.width * s, ph = productImg.height * s;
    ctx.drawImage(productImg, (SIZE - pw) / 2, (SIZE - ph) / 2, pw, ph);

    design._boxes = (design._spots || []).map(function (spot, i) {
      return drawPrint(ctx, design, spot, design._showGuides && i === design._active);
    });
    return canvas;
  }

  /* =======================================================================
     ProductDesigner — the customiser on the product page
     ======================================================================= */
  window.ProductDesigner = function (opts) {
    var mount = typeof opts.mount === 'string' ? XO.el(opts.mount) : opts.mount;
    if (!mount) return null;

    var product = opts.product;
    var state = {
      logo: '',
      logoName: '',
      logoPx: 0,
      removedBg: false,
      upscaled: false,
      lines: [],
      placement: CFG.PRINTING.placements[0],
      colour: 'White',
      inkColour: '#FFFFFF',
      _spots: [],
      _active: 0,
      _showGuides: true
    };
    var analysis = null;
    var logoImg = null;
    var productImg = null;
    var busy = false;

    mount.innerHTML =
      '<div class="designer">' +

        '<div class="designer__head">' +
          '<div>' +
            '<b>Add your logo and text</b>' +
            '<span>Upload once, drag it where you want it.</span>' +
          '</div>' +
          '<label class="switch">' +
            '<input type="checkbox" id="dsOn"><span>Customise this item</span>' +
          '</label>' +
        '</div>' +

        '<div id="dsBody" hidden>' +

          '<div class="designer__stage">' +
            '<div class="designer__preview">' +
              '<canvas id="dsCanvas" aria-label="Preview of your design on the product"></canvas>' +
              '<div class="designer__spinner" id="dsSpin" hidden>' +
                '<i class="fa-solid fa-circle-notch fa-spin"></i> Removing background…</div>' +
            '</div>' +
            '<div class="designer__stagebar">' +
              '<span id="dsSpots" class="designer__spots"></span>' +
              '<label class="designer__size">Size' +
                '<input type="range" id="dsScale" min="40" max="180" value="100">' +
              '</label>' +
            '</div>' +
            '<p class="form-text mb-0" id="dsHint">Drag the print to move it. Preview only — ' +
              'we send a production proof before printing.</p>' +
          '</div>' +

          '<div class="designer__fields">' +

            '<div class="designer__field designer__field--wide">' +
              '<label class="form-label" for="dsFile">Your logo</label>' +
              '<input class="form-control" type="file" id="dsFile" accept="image/png,image/jpeg,image/webp,image/svg+xml">' +
              '<div class="form-check mt-2">' +
                '<input class="form-check-input" type="checkbox" id="dsCut" checked>' +
                '<label class="form-check-label" for="dsCut" style="font-size:.86rem">' +
                  'Remove the background automatically</label>' +
              '</div>' +
              '<div class="form-check">' +
                '<input class="form-check-input" type="checkbox" id="dsSharp" checked>' +
                '<label class="form-check-label" for="dsSharp" style="font-size:.86rem">' +
                  'Improve a low-resolution logo</label>' +
              '</div>' +
              '<p class="form-text mb-0" id="dsFileNote">PNG, JPG or WebP. Works best on a plain background.</p>' +
            '</div>' +

            '<div class="designer__field designer__field--wide">' +
              '<span class="form-label d-block">Text to print</span>' +
              '<div id="dsLines">' +
                new Array(CFG.PRINTING.maxLines || 3).fill(0).map(function (_, i) {
                  return '<input class="form-control mb-2" data-line="' + i + '" maxlength="40" ' +
                    'placeholder="' + (i === 0 ? 'AL FAJER CONTRACTING' :
                                       i === 1 ? 'الفجر للمقاولات' : '+971 50 000 0000') + '">';
                }).join('') +
              '</div>' +
              '<p class="form-text mb-0">One row per line — company name, Arabic name, phone number. ' +
                'Arabic is detected automatically and printed right to left.</p>' +
            '</div>' +

            '<div class="designer__field">' +
              '<label class="form-label" for="dsPlace">Where to print</label>' +
              '<select class="form-select" id="dsPlace">' +
                CFG.PRINTING.placements.map(function (p) {
                  return '<option>' + XO.esc(p) + '</option>';
                }).join('') +
              '</select>' +
            '</div>' +

            '<div class="designer__field">' +
              '<span class="form-label d-block">Print colour</span>' +
              '<div class="swatches" id="dsColour" role="group" aria-label="Print colour">' +
                (CFG.PRINTING.inkColours || []).map(function (c, i) {
                  return '<button type="button" class="swatch' + (i === 0 ? ' is-active' : '') + '" ' +
                    'data-hex="' + c.hex + '" data-name="' + XO.esc(c.name) + '" ' +
                    'style="--sw:' + c.hex + '" aria-label="' + XO.esc(c.name) + '" ' +
                    'title="' + XO.esc(c.name) + '"></button>';
                }).join('') +
              '</div>' +
              '<p class="form-text mb-0" id="dsColourName">White print</p>' +
            '</div>' +

            '<div class="designer__field designer__field--wide d-flex flex-wrap gap-2">' +
              '<button class="btn btn-outline-xo btn-sm-xo" type="button" id="dsDownload">' +
                '<i class="fa-solid fa-download"></i> Save this preview</button>' +
              '<button class="btn btn-outline-xo btn-sm-xo" type="button" id="dsCentre">' +
                '<i class="fa-solid fa-crosshairs"></i> Reset position</button>' +
              '<button class="btn btn-outline-xo btn-sm-xo" type="button" id="dsReset">' +
                '<i class="fa-solid fa-rotate-left"></i> Start again</button>' +
            '</div>' +

          '</div>' +
        '</div>' +
      '</div>';

    var el = {
      on: XO.el('#dsOn', mount),
      body: XO.el('#dsBody', mount),
      canvas: XO.el('#dsCanvas', mount),
      spin: XO.el('#dsSpin', mount),
      file: XO.el('#dsFile', mount),
      cut: XO.el('#dsCut', mount),
      note: XO.el('#dsFileNote', mount),
      lines: XO.els('[data-line]', mount),
      sharp: XO.el('#dsSharp', mount),
      place: XO.el('#dsPlace', mount),
      colour: XO.el('#dsColour', mount),
      colourName: XO.el('#dsColourName', mount),
      scale: XO.el('#dsScale', mount),
      spots: XO.el('#dsSpots', mount),
      hint: XO.el('#dsHint', mount),
      download: XO.el('#dsDownload', mount),
      centre: XO.el('#dsCentre', mount),
      reset: XO.el('#dsReset', mount)
    };

    function repaint() {
      if (!productImg) return;
      state._logoImg = logoImg;
      drawMockup(el.canvas, productImg, state);
      if (typeof opts.onChange === 'function') opts.onChange(active());
    }

    function active() {
      return el.on.checked && !!(state.logo || state.lines.join(''));
    }

    /* One chip per print position, so a front-and-back placement can be
       adjusted one side at a time. Hidden when there is only one. */
    function renderSpots() {
      if (state._spots.length < 2) { el.spots.innerHTML = ''; return; }
      el.spots.innerHTML = state._spots.map(function (s, i) {
        return '<button type="button" data-spot="' + i + '"' +
          (i === state._active ? ' class="is-active"' : '') + '>' + XO.esc(s.label) + '</button>';
      }).join('');
      XO.els('[data-spot]', el.spots).forEach(function (b) {
        b.addEventListener('click', function () {
          state._active = parseInt(b.getAttribute('data-spot'), 10);
          el.scale.value = Math.round((state._spots[state._active].scale || 1) * 100);
          renderSpots();
          repaint();
        });
      });
    }

    function setPlacement(value) {
      state.placement = value;
      state._spots = spotsFor(value, analysis);
      state._active = 0;
      el.scale.value = 100;
      el.hint.innerHTML = state._spots.length > 1
        ? 'Two prints on this item — tap <b>' + XO.esc(state._spots[0].label) + '</b> or <b>' +
          XO.esc(state._spots[1].label) + '</b>, then drag it into place.'
        : 'Drag the print to move it. Preview only — we send a production proof before printing.';
      renderSpots();
      repaint();
    }

    /* ---- drag the print around the garment ---- */
    var dragging = false;

    function pointAt(e) {
      var r = el.canvas.getBoundingClientRect();
      var pt = e.touches && e.touches.length ? e.touches[0] : e;
      return { x: (pt.clientX - r.left) / r.width, y: (pt.clientY - r.top) / r.height };
    }

    function nearestSpot(pt) {
      var best = 0, bestD = Infinity;
      state._spots.forEach(function (s, i) {
        var d = Math.pow(s.x - pt.x, 2) + Math.pow(s.y - pt.y, 2);
        if (d < bestD) { bestD = d; best = i; }
      });
      return best;
    }

    function startDrag(e) {
      if (!el.on.checked) return;
      var pt = pointAt(e);
      state._active = nearestSpot(pt);
      el.scale.value = Math.round((state._spots[state._active].scale || 1) * 100);
      dragging = true;
      renderSpots();
      moveDrag(e);
    }

    function moveDrag(e) {
      if (!dragging) return;
      if (e.cancelable) e.preventDefault();
      var pt = pointAt(e);
      var s = state._spots[state._active];
      s.x = Math.min(0.96, Math.max(0.04, pt.x));
      s.y = Math.min(0.96, Math.max(0.04, pt.y));
      repaint();
    }

    function endDrag() { dragging = false; }

    el.canvas.addEventListener('mousedown', startDrag);
    el.canvas.addEventListener('touchstart', startDrag, { passive: true });
    window.addEventListener('mousemove', moveDrag);
    window.addEventListener('touchmove', moveDrag, { passive: false });
    window.addEventListener('mouseup', endDrag);
    window.addEventListener('touchend', endDrag);

    el.scale.addEventListener('input', function () {
      state._spots[state._active].scale = parseInt(el.scale.value, 10) / 100;
      repaint();
    });

    el.centre.addEventListener('click', function () { setPlacement(state.placement); });

    loadImage(product.images[0], true)
      .then(function (img) {
        productImg = img;
        analysis = analysePhoto(img);
        setPlacement(state.placement);
      })
      .catch(function () {
        var ctx = el.canvas.getContext('2d');
        el.canvas.width = SIZE; el.canvas.height = SIZE;
        ctx.fillStyle = '#F6F7F9'; ctx.fillRect(0, 0, SIZE, SIZE);
        ctx.fillStyle = '#6B7480'; ctx.font = "500 20px 'Inter', Arial, sans-serif";
        ctx.textAlign = 'center';
        ctx.fillText('Preview unavailable', SIZE / 2, SIZE / 2);
      });

    el.on.addEventListener('change', function () {
      el.body.hidden = !el.on.checked;
      if (el.on.checked) repaint();
      if (typeof opts.onChange === 'function') opts.onChange(active());
    });

    function processLogo(file) {
      if (!file) return;
      if (file.size > CFG.PRINTING.maxFileMB * 1024 * 1024) {
        el.note.innerHTML = '<span style="color:var(--xo-danger)">That file is over ' +
          CFG.PRINTING.maxFileMB + ' MB. Please use a smaller one.</span>';
        el.file.value = '';
        return;
      }
      busy = true;
      el.spin.hidden = false;
      state.logoName = file.name;

      var reader = new FileReader();
      reader.onload = function () {
        loadImage(reader.result, false).then(function (img) {
          var work = downscale(img, 900);
          var out, removedShare = 0;

          if (el.cut.checked) {
            var r = removeBackground(work, CFG.PRINTING.bgTolerance);
            removedShare = r.removed;
            out = trim(r.canvas);
            state.removedBg = true;
          } else {
            out = work;
            state.removedBg = false;
          }

          state.logoPx = Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height);
          state.upscaled = false;

          var target = CFG.PRINTING.minLogoPx || 600;
          if (el.sharp.checked && Math.max(out.width, out.height) < target) {
            out = sharpen(upscale(out, target), CFG.PRINTING.sharpenAmount || 0.45);
            state.upscaled = true;
          } else if (el.sharp.checked) {
            out = sharpen(out, (CFG.PRINTING.sharpenAmount || 0.45) * 0.5);
          }

          out = downscale(out, 900);
          state.logo = out.toDataURL('image/png');

          return loadImage(state.logo, false).then(function (li) {
            logoImg = li;
            busy = false;
            el.spin.hidden = true;
            if (el.cut.checked && removedShare < 0.02) {
              el.note.innerHTML = '<span style="color:var(--xo-amber-600)">Background looks busy, so little was ' +
                'removed. A logo on a plain white background works best — or untick the box and send us the file as is.</span>';
            } else if (el.cut.checked && removedShare > 0.985) {
              el.note.innerHTML = '<span style="color:var(--xo-danger)">Almost everything was removed. ' +
                'Untick the box and we will cut it out for you by hand.</span>';
            } else {
              var quality = state.logoPx < 200
                ? '<span style="color:var(--xo-danger)"> Low resolution (' + state.logoPx + 'px) — ' +
                  'ask the client for the original file if you can.</span>'
                : state.logoPx < (CFG.PRINTING.minLogoPx || 600)
                  ? '<span style="color:var(--xo-amber-600)"> ' + state.logoPx + 'px — usable, sharpened for print.</span>'
                  : '<span style="color:var(--xo-muted)"> ' + state.logoPx + 'px — good quality.</span>';
              el.note.innerHTML = '<span style="color:var(--xo-success)"><i class="fa-solid fa-circle-check"></i> ' +
                XO.esc(file.name) + ' added' + (state.removedBg ? ', background removed' : '') +
                (state.upscaled ? ', upscaled' : '') + '.</span>' + quality;
            }
            repaint();
          });
        }).catch(function () {
          busy = false;
          el.spin.hidden = true;
          el.note.innerHTML = '<span style="color:var(--xo-danger)">That image could not be read. ' +
            'Try a PNG or JPG.</span>';
        });
      };
      reader.readAsDataURL(file);
    }

    el.file.addEventListener('change', function () { processLogo(el.file.files[0]); });
    el.cut.addEventListener('change', function () {
      if (el.file.files && el.file.files[0]) processLogo(el.file.files[0]);
    });
    el.sharp.addEventListener('change', function () {
      if (el.file.files && el.file.files[0]) processLogo(el.file.files[0]);
    });

    el.lines.forEach(function (inp, i) {
      inp.addEventListener('input', function () {
        state.lines[i] = inp.value.trim();
        inp.setAttribute('dir', isArabic(inp.value) ? 'rtl' : 'ltr');
        repaint();
      });
    });
    el.place.addEventListener('change', function () { setPlacement(el.place.value); });

    XO.els('[data-hex]', el.colour).forEach(function (sw) {
      sw.addEventListener('click', function () {
        XO.els('[data-hex]', el.colour).forEach(function (o) { o.classList.remove('is-active'); });
        sw.classList.add('is-active');
        state.inkColour = sw.getAttribute('data-hex');
        state.colour = sw.getAttribute('data-name');
        el.colourName.textContent = state.colour + ' print';
        repaint();
      });
    });

    el.download.addEventListener('click', function () {
      state._showGuides = false; repaint();
      var a = document.createElement('a');
      a.href = el.canvas.toDataURL('image/png');
      state._showGuides = true; setTimeout(repaint, 50);
      a.download = XO.slug(product.title) + '-design.png';
      a.click();
    });

    el.reset.addEventListener('click', function () {
      state.logo = ''; state.logoName = ''; state.lines = [];
      logoImg = null;
      el.file.value = '';
      el.lines.forEach(function (i) { i.value = ''; });
      el.note.textContent = 'PNG, JPG or WebP. Works best on a plain background.';
      setPlacement(state.placement);
    });

    setPlacement(CFG.PRINTING.placements[0]);

    return {
      isActive: active,
      isBusy: function () { return busy; },
      design: function () {
        if (!active()) return null;
        var mockup = '';
        state._showGuides = false;
        repaint();
        try { mockup = el.canvas.toDataURL('image/jpeg', 0.72); } catch (e) {}
        state._showGuides = true;
        repaint();
        return {
          product: product.title,
          logo: state.logo,
          logoName: state.logoName,
          removedBg: state.removedBg,
          upscaled: state.upscaled,
          logoPx: state.logoPx,
          lines: state.lines.filter(Boolean),
          en: state.lines.filter(function (l) { return l && !isArabic(l); })[0] || '',
          ar: state.lines.filter(function (l) { return isArabic(l); })[0] || '',
          placement: state.placement,
          positions: state._spots.map(function (s) {
            return { label: s.label, x: Math.round(s.x * 100) / 100,
                     y: Math.round(s.y * 100) / 100, scale: s.scale || 1 };
          }),
          colour: state.colour,
          inkColour: state.inkColour,
          mockup: mockup
        };
      }
    };
  };

  /* =======================================================================
     DesignSheet — every design in the order, on one image for the email
     ======================================================================= */
  window.DesignSheet = {

    build: function () {
      var all = Designs.all();
      var keys = Object.keys(all).filter(function (k) { return all[k] && all[k].mockup; });
      if (!keys.length) return Promise.resolve(null);

      var cols = keys.length === 1 ? 1 : 2;
      var rows = Math.ceil(keys.length / cols);
      var cell = 520, capH = 96, pad = 24;

      var cv = document.createElement('canvas');
      cv.width = pad + cols * (cell + pad);
      cv.height = pad + rows * (cell + capH + pad) + 56;
      var ctx = cv.getContext('2d');

      function cut(text, maxW) {
        if (ctx.measureText(text).width <= maxW) return text;
        var t = text;
        while (t.length > 4 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1);
        return t + '…';
      }

      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.fillStyle = '#0E1116';
      ctx.font = "700 26px 'Inter', Arial, sans-serif";
      ctx.textAlign = 'left';
      ctx.fillText('Customer artwork — ' + keys.length + ' item' + (keys.length === 1 ? '' : 's'), pad, 36);

      return Promise.all(keys.map(function (k) {
        return loadImage(all[k].mockup, false).then(function (img) { return { k: k, img: img }; });
      })).then(function (loaded) {
        loaded.forEach(function (item, i) {
          var d = all[item.k];
          var col = i % cols, row = Math.floor(i / cols);
          var x = pad + col * (cell + pad);
          var y = 56 + pad + row * (cell + capH + pad);

          ctx.drawImage(item.img, x, y, cell, cell);
          ctx.strokeStyle = '#E4E7EC';
          ctx.strokeRect(x + 0.5, y + 0.5, cell, cell);

          ctx.fillStyle = '#0E1116';
          ctx.font = "700 17px 'Inter', Arial, sans-serif";
          ctx.textAlign = 'left';
          ctx.fillText(cut(d.product, cell), x, y + cell + 24);

          ctx.fillStyle = '#4A535E';
          ctx.font = "400 14px 'Inter', Arial, sans-serif";
          var lines = [];
          if (d.en) lines.push('EN: ' + d.en);
          if (d.ar) lines.push('AR: ' + d.ar);
          lines.push(d.placement + (d.colour ? ' · ' + d.colour : '') +
                     (d.logoName ? ' · ' + d.logoName : ''));
          lines.slice(0, 3).forEach(function (l, n) {
            ctx.fillText(cut(l, cell), x, y + cell + 46 + n * 19);
          });
        });

        return new Promise(function (resolve) {
          cv.toBlob(function (blob) {
            resolve(blob ? new File([blob], 'customer-artwork.png', { type: 'image/png' }) : null);
          }, 'image/png');
        });
      });
    }
  };

  /* =======================================================================
     Shared engine — reused by the brand kit
     ======================================================================= */
  window.XODesign = {
    loadImage: loadImage,
    removeBackground: removeBackground,
    trim: trim,
    downscale: downscale,
    upscale: upscale,
    sharpen: sharpen,
    analysePhoto: analysePhoto,
    spotsFor: spotsFor,
    drawMockup: drawMockup,
    linesOf: linesOf,
    isArabic: isArabic,
    SIZE: SIZE
  };

  /* =======================================================================
     Cart page — show the approved design against each line, with no
     changes needed to cart.html itself
     ======================================================================= */
  function decorateCart() {
    if (!XO.el('.cart-line')) return;
    XO.els('.cart-line').forEach(function (row) {
      if (XO.el('.design-chip', row)) return;
      var d = Designs.get(row.getAttribute('data-key'));
      if (!d) return;

      var wrap = document.createElement('div');
      wrap.className = 'design-chip';
      wrap.innerHTML =
        (d.mockup ? '<img src="' + d.mockup + '" alt="Your design">' : '') +
        '<div><b>Your artwork</b><span>' + XO.esc(Designs.describe(d)) + '</span></div>';
      var body = row.children[1];
      if (body) body.appendChild(wrap);
    });
  }

  /* The cart page builds its lines in its own DOMContentLoaded handler, so
     decorate on the next tick and once more after any late render. */
  document.addEventListener('DOMContentLoaded', function () {
    Designs.prune();
    setTimeout(decorateCart, 0);
    setTimeout(decorateCart, 400);
  });

  document.addEventListener('cart:change', function () {
    setTimeout(function () { Designs.prune(); decorateCart(); }, 60);
  });

})();
