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

  function loadImage(src, crossOrigin, retry) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      if (crossOrigin) img.crossOrigin = 'anonymous';
      img.onload = function () { resolve(img); };
      img.onerror = function () {
        /* A product photo the page has already shown as a plain thumbnail is
           sitting in the browser cache without its CORS headers, and asking
           for it again with crossOrigin fails against that cached copy. One
           retry on a slightly different URL forces a fresh request that does
           carry the headers. Without this the first preview of a session can
           fail while every later one works. */
        if (crossOrigin && !retry && src.indexOf('data:') !== 0) {
          var bust = src + (src.indexOf('?') > -1 ? '&' : '?') + 'cors=1';
          loadImage(bust, true, true).then(resolve, reject);
          return;
        }
        reject(new Error('Could not load image'));
      };
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

      /* An outline of the garment: where its left and right edges actually
         are at a series of heights. A vest is far narrower at the shoulder
         than at the hem, so a sleeve print positioned against the bounding
         box lands in mid-air. Positioned against this outline, it lands on
         the garment. */
      var SLICES = 24, prof = [], k, yy, l, rr;
      for (k = 0; k < SLICES; k++) {
        yy = Math.min(H - 1, Math.round(top + (bottom - top) * (k + 0.5) / SLICES));
        l = -1; rr = -1;
        for (x = r.a; x <= r.b; x++) {
          if (isSubject((yy * W + x) * 4)) { if (l < 0) l = x; rr = x; }
        }
        if (l < 0) { l = r.a; rr = r.b; }
        prof.push({ l: l / W, r: (rr + 1) / W });
      }

      return {
        x: r.a / W, y: top / H,
        w: (r.b - r.a + 1) / W, h: (bottom - top + 1) / H,
        profile: prof
      };
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
      /* A photo with only one view still honours a "back" print - it simply
         lands on the view that is there. */
      var b = blobs[Math.min(s.view, blobs.length - 1)];
      var cx = b.x + b.w * s.rx;

      /* A sleeve print is described as "just inside the left edge", not as a
         fraction of the bounding box, so it follows the shape of whatever
         garment the photo shows. */
      if (s.edge && b.profile && b.profile.length) {
        var n = b.profile.length;
        var e = b.profile[Math.max(0, Math.min(n - 1, Math.round(s.ry * n - 0.5)))];
        /* Sit a full print-width in from the edge. The outline can pick up a
           soft pixel just outside the fabric, and half a logo hanging off the
           arm looks worse than one placed slightly too far in. */
        var half = b.w * s.rw * 1.15;
        cx = s.edge === 'right' ? (e.r - half) : (e.l + half);
        /* Never let it cross the middle of the garment. */
        var mid = b.x + b.w * 0.5;
        if (s.edge === 'right') cx = Math.max(cx, mid + half * 0.5);
        else cx = Math.min(cx, mid - half * 0.5);
      }

      return {
        x: cx,
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
  /* =======================================================================
     Layers
     -----------------------------------------------------------------------
     A print is a stack of independent layers - the logo, and one layer per
     line of text. Each carries its own offset from the print's anchor, its
     own size and its own colour, so any of them can be moved or resized
     without disturbing the others. Layers that share a group id move
     together.

     The first render lays them out automatically, exactly as the old fixed
     composition did, and then freezes that result into layer coordinates.
     Nothing looks different until somebody moves something.

     Offsets are fractions of the photo, sizes are fractions of the photo's
     width, so a print stays put whatever size the canvas is drawn at.
     ======================================================================= */

  var layerSeq = 0;
  function nextLayerId() { return 'L' + (++layerSeq); }

  function fontFor(text) {
    return isArabic(text)
      ? "'Noto Sans Arabic', 'Segoe UI', Tahoma, Arial, sans-serif"
      : "'Inter', Arial, sans-serif";
  }

  /* A flat, single-colour version of the logo, keeping its shape. Screen
     printing is often one colour anyway, and a client's logo frequently has
     to be restated in the garment's ink. */
  function tintImage(img, hex) {
    if (!img) return img;
    if (!img._tintCache) img._tintCache = {};
    if (img._tintCache[hex]) return img._tintCache[hex];

    var cv = document.createElement('canvas');
    cv.width = img.naturalWidth || img.width;
    cv.height = img.naturalHeight || img.height;
    var c = cv.getContext('2d');
    c.drawImage(img, 0, 0, cv.width, cv.height);
    c.globalCompositeOperation = 'source-in';
    c.fillStyle = hex;
    c.fillRect(0, 0, cv.width, cv.height);
    c.globalCompositeOperation = 'source-over';

    img._tintCache[hex] = cv;
    return cv;
  }

  /* =======================================================================
     Recolouring a logo
     -----------------------------------------------------------------------
     Illustrator recolours a vector by changing the fill on each path. A logo
     that arrived as a PNG or a WhatsApp screenshot has no paths, so instead
     we find the handful of distinct colours it is actually made of and let
     each one be swapped. On flat artwork - which nearly every printed logo
     is - the result is the same thing: change the red ring, keep the navy
     lettering.

     What this cannot do is give back clean edges the original file had. If
     the client can send the AI, EPS or PDF, that is always the better route
     and the production file should come from there.
     ======================================================================= */

  /* The distinct colours a logo is built from, biggest share first. */
  function logoPalette(img, maxColours) {
    maxColours = maxColours || 6;
    if (img._palette) return img._palette;

    var W = 90;
    var H = Math.max(1, Math.round((img.height / img.width) * W));
    var cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    var c = cv.getContext('2d');
    c.drawImage(img, 0, 0, W, H);

    var d;
    try { d = c.getImageData(0, 0, W, H).data; } catch (e) { return []; }

    /* Bucket into a coarse grid first, so anti-aliased pixels join the
       nearest solid colour instead of each becoming its own entry. */
    var bins = {};
    for (var i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 128) continue;
      var key = (d[i] >> 4) + ',' + (d[i + 1] >> 4) + ',' + (d[i + 2] >> 4);
      var b = bins[key];
      if (!b) b = bins[key] = { r: 0, g: 0, b: 0, n: 0 };
      b.r += d[i]; b.g += d[i + 1]; b.b += d[i + 2]; b.n++;
    }

    var list = [];
    Object.keys(bins).forEach(function (k) {
      var b = bins[k];
      list.push({
        r: Math.round(b.r / b.n), g: Math.round(b.g / b.n), bl: Math.round(b.b / b.n),
        n: b.n
      });
    });
    list.sort(function (a, b) { return b.n - a.n; });

    /* Merge anything close to a colour already kept. */
    var keep = [];
    list.forEach(function (o) {
      for (var j = 0; j < keep.length; j++) {
        var k = keep[j];
        var dist = Math.abs(k.r - o.r) + Math.abs(k.g - o.g) + Math.abs(k.bl - o.bl);
        if (dist < 60) { k.n += o.n; return; }
      }
      if (keep.length < maxColours) keep.push(o);
    });

    var total = keep.reduce(function (n, o) { return n + o.n; }, 0) || 1;
    img._palette = keep.map(function (o) {
      return { hex: rgbToHex(o.r, o.g, o.bl), share: o.n / total };
    });
    return img._palette;
  }

  /* Rebuilds the logo with some of its colours swapped. Every pixel is
     matched to the nearest palette entry, so the anti-aliased edges follow
     their colour rather than being left behind. */
  function recolourImage(img, map) {
    var keys = Object.keys(map || {}).filter(function (k) { return map[k]; });
    if (!keys.length) return img;

    var cacheKey = keys.sort().map(function (k) { return k + '>' + map[k]; }).join('|');
    if (!img._recolourCache) img._recolourCache = {};
    if (img._recolourCache[cacheKey]) return img._recolourCache[cacheKey];

    var palette = logoPalette(img);
    if (!palette.length) return img;

    var swatches = palette.map(function (p) {
      var rgb = hexToRgb(p.hex) || { r: 0, g: 0, b: 0 };
      var to = map[p.hex] ? hexToRgb(map[p.hex]) : null;
      return { from: rgb, to: to };
    });

    var cv = document.createElement('canvas');
    cv.width = img.naturalWidth || img.width;
    cv.height = img.naturalHeight || img.height;
    var c = cv.getContext('2d');
    c.drawImage(img, 0, 0, cv.width, cv.height);

    var d;
    try { d = c.getImageData(0, 0, cv.width, cv.height); } catch (e) { return img; }
    var px = d.data;

    for (var i = 0; i < px.length; i += 4) {
      if (px[i + 3] < 8) continue;
      var best = -1, bestD = Infinity;
      for (var s = 0; s < swatches.length; s++) {
        var f = swatches[s].from;
        var dd = Math.abs(f.r - px[i]) + Math.abs(f.g - px[i + 1]) + Math.abs(f.b - px[i + 2]);
        if (dd < bestD) { bestD = dd; best = s; }
      }
      var t = best > -1 ? swatches[best].to : null;
      if (!t) continue;
      /* Keep the pixel's own light and shade by carrying the difference from
         its old colour across to the new one. */
      var f2 = swatches[best].from;
      px[i]     = Math.max(0, Math.min(255, t.r + (px[i]     - f2.r)));
      px[i + 1] = Math.max(0, Math.min(255, t.g + (px[i + 1] - f2.g)));
      px[i + 2] = Math.max(0, Math.min(255, t.b + (px[i + 2] - f2.b)));
    }
    c.putImageData(d, 0, 0);

    img._recolourCache[cacheKey] = cv;
    return cv;
  }

  /* Whichever version of the logo a layer should draw. */
  function logoFor(design, L) {
    var imgs = design._logoImgs || (design._logoImg ? [design._logoImg] : []);
    var img = imgs[L.logoIndex || 0] || imgs[0];
    if (!img) return null;
    if (L.recolour && Object.keys(L.recolour).length) return recolourImage(img, L.recolour);
    if (L.tint) return tintImage(img, L.tint);
    return img;
  }

  function logoSource(design, L) {
    var imgs = design._logoImgs || (design._logoImg ? [design._logoImg] : []);
    return imgs[L.logoIndex || 0] || imgs[0] || null;
  }

  /* Lays the logo and the text out automatically and returns the result as
     layers. This is the old composition, measured rather than drawn. */
  function autoLayers(ctx, design, spot, R) {
    var U = SIZE * R.w;
    var Hp = SIZE * R.h;
    var base = U * spot.w;
    var hMax = Hp * (spot.hMax || 0.4);

    var rows = linesOf(design);
    if (typeof spot.rows === 'number') {
      rows = rows.slice(0, logoSource(design, { logoIndex: spot.logoIndex || 0 })
        ? spot.rows : Math.max(1, spot.rows));
    }

    var hasLogo = !!logoSource(design, { logoIndex: spot.logoIndex || 0 });
    var layout = spot.layout || 'stack';
    var beside = (layout === 'left' || layout === 'right') && hasLogo && rows.length;

    ctx.textBaseline = 'top';
    function fit(text, font, dir, avail) {
      var px = Math.max(9, Math.round(avail * 0.19));
      ctx.direction = dir;
      while (px > 7) {
        ctx.font = '700 ' + px + 'px ' + font;
        if (ctx.measureText(text).width <= avail) break;
        px -= 1;
      }
      return px;
    }

    var textAvail = base * (beside ? 0.60 : 1);
    var logoW = base * (beside ? 0.34 : 1);

    var tRows = rows.map(function (line) {
      var rtl = isArabic(line);
      var font = fontFor(line);
      var px = fit(line, font, rtl ? 'rtl' : 'ltr', textAvail);
      ctx.font = '700 ' + px + 'px ' + font;
      ctx.direction = rtl ? 'rtl' : 'ltr';
      return { text: line, font: font, dir: rtl ? 'rtl' : 'ltr', px: px, w: ctx.measureText(line).width };
    });
    ctx.direction = 'ltr';

    var li = logoSource(design, { logoIndex: spot.logoIndex || 0 });
    var logo = li ? { w: logoW, h: li.height * (logoW / li.width) } : null;
    if (!logo && !tRows.length) return [];

    var gap = base * 0.06;
    function textH() {
      return tRows.reduce(function (n, r, i) { return n + r.px * 1.15 + (i ? gap * 0.55 : 0); }, 0);
    }
    function textW() {
      return tRows.reduce(function (n, r) { return Math.max(n, r.w); }, 0);
    }

    var totalH = beside
      ? Math.max(logo ? logo.h : 0, textH())
      : (logo ? logo.h : 0) + (logo && tRows.length ? gap : 0) + textH();

    /* Only the automatic pass is held inside the panel. Once a person takes
       over, their sizes are their business. */
    if (totalH > hMax) {
      var k = hMax / totalH;
      if (logo) { logo.w *= k; logo.h *= k; }
      tRows.forEach(function (r) { r.px *= k; r.w *= k; });
      gap *= k;
      totalH = beside
        ? Math.max(logo ? logo.h : 0, textH())
        : (logo ? logo.h : 0) + (logo && tRows.length ? gap : 0) + textH();
    }

    var out = [];
    function push(o) { o.id = nextLayerId(); o.scale = 1; o.group = null; out.push(o); }

    /* Offsets are measured from the middle of the print, in canvas pixels
       first and converted at the end. */
    function place(kind, o, offX, offY) {
      o.kind = kind;
      o.dx = offX / U;
      o.dy = offY / Hp;
      push(o);
    }

    if (beside) {
      var tw = textW(), th = textH();
      var totalW = logo.w + gap + tw;
      var leftEdge = -totalW / 2;
      var logoCx = layout === 'left' ? leftEdge + logo.w / 2 : leftEdge + tw + gap + logo.w / 2;
      var textLeft = layout === 'left' ? leftEdge + logo.w + gap : leftEdge;

      place('logo', { w: logo.w / U, tint: null, recolour: null,
                      logoIndex: spot.logoIndex || 0 }, logoCx, 0);

      var y = -th / 2;
      tRows.forEach(function (r, i) {
        if (i) y += gap * 0.55;
        place('text', {
          text: r.text, font: r.font, dir: r.dir, size: r.px / U, ink: null
        }, textLeft + tw / 2, y + r.px * 0.575);
        y += r.px * 1.15;
      });
    } else {
      var yy = -totalH / 2;
      if (logo) {
        place('logo', { w: logo.w / U, tint: null, recolour: null,
                        logoIndex: spot.logoIndex || 0 }, 0, yy + logo.h / 2);
        yy += logo.h + (tRows.length ? gap : 0);
      }
      tRows.forEach(function (r, i) {
        if (i) yy += gap * 0.55;
        place('text', {
          text: r.text, font: r.font, dir: r.dir, size: r.px / U, ink: null
        }, 0, yy + r.px * 0.575);
        yy += r.px * 1.15;
      });
    }

    return out;
  }

  /* Draws every layer of a print and records where each one landed, in
     canvas pixels, so the editor can work out what was clicked. */
  function drawPrint(ctx, design, spot, highlight) {
    var R = design._rect || { x: 0, y: 0, w: 1, h: 1 };

    if (!spot.layers || spot._layoutKey !== layoutKey(design, spot)) {
      spot.layers = autoLayers(ctx, design, spot, R);
      spot._layoutKey = layoutKey(design, spot);
    }
    if (!spot.layers.length) { spot._boxes = []; return null; }

    var U = SIZE * R.w;
    var Hp = SIZE * R.h;
    var s = spot.scale || 1;
    var fallbackInk = spot.ink || design.inkColour || '#111111';
    var boxes = [];
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    spot.layers.forEach(function (L, i) {
      var k = s * (L.scale || 1);
      var cx = SIZE * (R.x + R.w * (spot.x + L.dx * s));
      var cy = SIZE * (R.y + R.h * (spot.y + L.dy * s));
      var bx, by, bw, bh;

      if (L.kind === 'logo') {
        var img = logoSource(design, L);
        if (!img) return;
        var src = logoFor(design, L);
        bw = U * L.w * k;
        bh = bw * (img.height / img.width);
        bx = cx - bw / 2;
        by = cy - bh / 2;
        ctx.drawImage(src, bx, by, bw, bh);
      } else {
        if (!L.text) return;
        var px = Math.max(6, U * L.size * k);
        ctx.font = '700 ' + px + 'px ' + L.font;
        ctx.direction = L.dir || 'ltr';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = L.ink || fallbackInk;
        ctx.fillText(L.text, cx, cy);
        ctx.direction = 'ltr';
        bw = ctx.measureText(L.text).width;
        bh = px * 1.2;
        bx = cx - bw / 2;
        by = cy - bh / 2;
      }

      boxes.push({ i: i, id: L.id, x: bx, y: by, w: bw, h: bh });
      minX = Math.min(minX, bx); minY = Math.min(minY, by);
      maxX = Math.max(maxX, bx + bw); maxY = Math.max(maxY, by + bh);
    });

    spot._boxes = boxes;
    if (!boxes.length) return null;

    var box = { x: minX, y: minY, w: maxX - minX, h: maxY - minY };

    if (highlight) {
      var target = box;
      if (typeof spot._activeLayer === 'number' && boxes[spot._activeLayer]) {
        target = boxes[spot._activeLayer];
      }
      var m = U * spot.w * 0.1;
      ctx.save();
      ctx.strokeStyle = '#FFB800';
      ctx.lineWidth = 2;
      ctx.setLineDash([7, 5]);
      ctx.strokeRect(target.x - m, target.y - m, target.w + m * 2, target.h + m * 2);
      ctx.setLineDash([]);
      ctx.fillStyle = '#FFB800';
      ctx.font = "700 15px 'Inter', Arial, sans-serif";
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(spot.label, target.x - m, target.y - m - 8);
      ctx.restore();
    }
    return box;
  }

  /* Automatic layout is redone only when the ingredients change - not when
     somebody nudges a layer. */
  function layoutKey(design, spot) {
    return [
      linesOf(design).join('\u0001'),
      (design._logoImgs || []).length,
      (function () { var i = logoSource(design, { logoIndex: spot.logoIndex || 0 });
        return i ? (i.src || '').slice(-40) : 'none'; })(),
      spot.layout || 'stack',
      spot.rows == null ? 'x' : spot.rows
    ].join('|');
  }

  /* Which layer is under this canvas point? Topmost wins. */
  function layerAt(spot, px, py) {
    var boxes = spot._boxes || [];
    for (var i = boxes.length - 1; i >= 0; i--) {
      var b = boxes[i];
      var pad = Math.max(6, b.h * 0.15);
      if (px >= b.x - pad && px <= b.x + b.w + pad &&
          py >= b.y - pad && py <= b.y + b.h + pad) return b.i;
    }
    return -1;
  }

  /* Adds a line of text to a print, under whatever is already there. */
  function addTextLayer(spot, text) {
    if (!spot.layers) spot.layers = [];
    var lowest = spot.layers.reduce(function (n, L) { return Math.max(n, L.dy); }, 0);
    var size = 0;
    spot.layers.forEach(function (L) { if (L.kind === 'text') size = Math.max(size, L.size); });
    if (!size) size = spot.w * 0.16;

    var L = {
      id: nextLayerId(), kind: 'text', text: text || 'New line',
      font: fontFor(text), dir: isArabic(text) ? 'rtl' : 'ltr',
      size: size, ink: null, scale: 1, group: null,
      dx: 0, dy: lowest + size * 1.5
    };
    spot.layers.push(L);
    return L;
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
    var dx = (SIZE - pw) / 2, dy = (SIZE - ph) / 2;
    ctx.drawImage(productImg, dx, dy, pw, ph);

    /* Print positions are fractions of the PHOTO, but the photo is letterboxed
       into a square canvas. Without this rectangle to map through, every print
       drifts - barely on a square photo, badly on a tall one. */
    design._rect = { x: dx / SIZE, y: dy / SIZE, w: pw / SIZE, h: ph / SIZE };

    design._boxes = (design._spots || []).map(function (spot, i) {
      spot._activeLayer = (i === design._active) ? design._activeLayer : null;
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
                '<button type="button" class="swatch swatch--custom" id="dsCustom" ' +
                  'title="Any other colour" aria-label="Choose any other colour">' +
                  '<i class="fa-solid fa-eye-dropper"></i></button>' +
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
      custom: XO.el('#dsCustom', mount),
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
      renderSpots();
      repaint();
      refreshHint();
    }

    /* A chest badge has room for one line, a sleeve for none. If the customer
       has typed more than the chosen placement can show, say so rather than
       letting rows vanish from the preview without explanation. */
    function refreshHint() {
      if (!state._spots) return;
      el.hint.innerHTML = state._spots.length > 1
        ? 'Two prints on this item — tap <b>' + XO.esc(state._spots[0].label) + '</b> or <b>' +
          XO.esc(state._spots[1].label) + '</b>, then drag it into place.'
        : 'Drag the print to move it. Preview only — we send a production proof before printing.';

      var typed = linesOf(state).length;
      if (!typed) return;
      var most = 0, capped = false;
      state._spots.forEach(function (s) {
        var n = typeof s.rows === 'number'
          ? (state._logoImg ? s.rows : Math.max(1, s.rows))
          : typed;
        if (n < typed) capped = true;
        if (n > most) most = n;
      });
      if (!capped || most >= typed) return;
      el.hint.innerHTML += '<br><span style="color:var(--xo-amber-600)">' +
        'This position fits ' + (most === 1 ? 'one line' : most + ' lines') +
        ' of text. Choose a placement that includes the back to print all ' + typed + '.</span>';
    }

    /* ---- drag the print around the garment ---- */
    var dragging = false;

    function pointAt(e) {
      var r = el.canvas.getBoundingClientRect();
      var pt = e.touches && e.touches.length ? e.touches[0] : e;
      var R = state._rect || { x: 0, y: 0, w: 1, h: 1 };
      /* Back out of canvas space into the photo's own coordinates, so a print
         dragged to the shoulder stays on the shoulder. */
      return {
        x: ((pt.clientX - r.left) / r.width - R.x) / R.w,
        y: ((pt.clientY - r.top) / r.height - R.y) / R.h
      };
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
        refreshHint();
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

    el.custom.addEventListener('click', function () {
      XOColour.open({
        hex: state.inkColour || '#FFFFFF',
        trigger: el.custom,
        onChange: function (hex) {
          state.inkColour = hex;
          el.custom.style.setProperty('--sw', hex);
          repaint();
        },
        onDone: function (hex) {
          XO.els('[data-hex]', el.colour).forEach(function (o) { o.classList.remove('is-active'); });
          el.custom.classList.add('is-active');
          state.inkColour = hex;
          state.colour = hex;
          el.colourName.textContent = hex + ' print';
          repaint();
        }
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
     Colour picker
     -----------------------------------------------------------------------
     The six swatches cover most jobs, but a client's brand colour rarely
     lands on one of them. This is the usual saturation/brightness square with
     a hue strip beside it, plus HEX, RGB and CMYK boxes that all stay in step
     with each other. CMYK is a plain arithmetic conversion, good enough to
     type a brand value into - the press proof remains the reference.
     ======================================================================= */

  function clamp255(n) { return Math.max(0, Math.min(255, Math.round(n))); }

  function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(function (v) {
      var s = clamp255(v).toString(16);
      return s.length < 2 ? '0' + s : s;
    }).join('').toUpperCase();
  }

  function hexToRgb(hex) {
    var h = String(hex || '').replace('#', '').trim();
    if (h.length === 3) h = h.charAt(0) + h.charAt(0) + h.charAt(1) + h.charAt(1) + h.charAt(2) + h.charAt(2);
    if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16)
    };
  }

  function rgbToHsv(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    var h = 0;
    if (d) {
      if (max === r) h = ((g - b) / d + (g < b ? 6 : 0));
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
    }
    return { h: h, s: max ? d / max : 0, v: max };
  }

  function hsvToRgb(h, s, v) {
    h = ((h % 360) + 360) % 360;
    var c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c;
    var r = 0, g = 0, b = 0;
    if (h < 60) { r = c; g = x; }
    else if (h < 120) { r = x; g = c; }
    else if (h < 180) { g = c; b = x; }
    else if (h < 240) { g = x; b = c; }
    else if (h < 300) { r = x; b = c; }
    else { r = c; b = x; }
    return { r: clamp255((r + m) * 255), g: clamp255((g + m) * 255), b: clamp255((b + m) * 255) };
  }

  function rgbToCmyk(r, g, b) {
    var rr = r / 255, gg = g / 255, bb = b / 255;
    var k = 1 - Math.max(rr, gg, bb);
    if (k >= 1) return { c: 0, m: 0, y: 0, k: 100 };
    return {
      c: Math.round((1 - rr - k) / (1 - k) * 100),
      m: Math.round((1 - gg - k) / (1 - k) * 100),
      y: Math.round((1 - bb - k) / (1 - k) * 100),
      k: Math.round(k * 100)
    };
  }

  function cmykToRgb(c, m, y, k) {
    c /= 100; m /= 100; y /= 100; k /= 100;
    return {
      r: clamp255(255 * (1 - c) * (1 - k)),
      g: clamp255(255 * (1 - m) * (1 - k)),
      b: clamp255(255 * (1 - y) * (1 - k))
    };
  }

  var pickerEl = null;
  var pickerState = null;

  function buildPicker() {
    var d = document.createElement('div');
    d.className = 'xo-picker';
    d.setAttribute('role', 'dialog');
    d.setAttribute('aria-label', 'Choose a print colour');
    d.innerHTML =
      '<div class="xo-picker__top">' +
        '<canvas class="xo-picker__sv" width="220" height="150"></canvas>' +
        '<canvas class="xo-picker__hue" width="18" height="150"></canvas>' +
      '</div>' +
      '<div class="xo-picker__row">' +
        '<span class="xo-picker__chip"></span>' +
        '<label class="xo-picker__hex">HEX' +
          '<input type="text" spellcheck="false" maxlength="7"></label>' +
      '</div>' +
      '<div class="xo-picker__grid" data-mode="rgb">' +
        '<label>R<input type="number" min="0" max="255" data-k="r"></label>' +
        '<label>G<input type="number" min="0" max="255" data-k="g"></label>' +
        '<label>B<input type="number" min="0" max="255" data-k="b"></label>' +
      '</div>' +
      '<div class="xo-picker__grid" data-mode="cmyk">' +
        '<label>C<input type="number" min="0" max="100" data-k="c"></label>' +
        '<label>M<input type="number" min="0" max="100" data-k="m"></label>' +
        '<label>Y<input type="number" min="0" max="100" data-k="y"></label>' +
        '<label>K<input type="number" min="0" max="100" data-k="k"></label>' +
      '</div>' +
      '<div class="xo-picker__foot">' +
        '<button type="button" class="xo-picker__cancel">Cancel</button>' +
        '<button type="button" class="xo-picker__ok">Use this colour</button>' +
      '</div>';
    document.body.appendChild(d);
    return d;
  }

  function paintPicker() {
    var el = pickerEl, st = pickerState;
    var sv = el.querySelector('.xo-picker__sv');
    var hue = el.querySelector('.xo-picker__hue');
    var c = sv.getContext('2d');

    var pure = hsvToRgb(st.h, 1, 1);
    c.fillStyle = 'rgb(' + pure.r + ',' + pure.g + ',' + pure.b + ')';
    c.fillRect(0, 0, sv.width, sv.height);

    var gw = c.createLinearGradient(0, 0, sv.width, 0);
    gw.addColorStop(0, 'rgba(255,255,255,1)');
    gw.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = gw;
    c.fillRect(0, 0, sv.width, sv.height);

    var gb = c.createLinearGradient(0, 0, 0, sv.height);
    gb.addColorStop(0, 'rgba(0,0,0,0)');
    gb.addColorStop(1, 'rgba(0,0,0,1)');
    c.fillStyle = gb;
    c.fillRect(0, 0, sv.width, sv.height);

    var px = st.s * sv.width;
    var py = (1 - st.v) * sv.height;
    c.beginPath();
    c.arc(px, py, 7, 0, Math.PI * 2);
    c.strokeStyle = '#fff'; c.lineWidth = 2; c.stroke();
    c.beginPath();
    c.arc(px, py, 9, 0, Math.PI * 2);
    c.strokeStyle = 'rgba(0,0,0,.5)'; c.lineWidth = 1; c.stroke();

    var hc = hue.getContext('2d');
    var g = hc.createLinearGradient(0, 0, 0, hue.height);
    for (var i = 0; i <= 6; i++) {
      var rg = hsvToRgb(i * 60, 1, 1);
      g.addColorStop(i / 6, 'rgb(' + rg.r + ',' + rg.g + ',' + rg.b + ')');
    }
    hc.fillStyle = g;
    hc.fillRect(0, 0, hue.width, hue.height);
    var hy = (st.h / 360) * hue.height;
    hc.fillStyle = '#fff';
    hc.fillRect(0, Math.max(0, hy - 2), hue.width, 3);
    hc.strokeStyle = 'rgba(0,0,0,.45)';
    hc.strokeRect(0.5, Math.max(0, hy - 2.5), hue.width - 1, 4);

    var rgb = hsvToRgb(st.h, st.s, st.v);
    var hex = rgbToHex(rgb.r, rgb.g, rgb.b);
    el.querySelector('.xo-picker__chip').style.background = hex;
    if (document.activeElement !== el.querySelector('.xo-picker__hex input')) {
      el.querySelector('.xo-picker__hex input').value = hex;
    }
    var cmyk = rgbToCmyk(rgb.r, rgb.g, rgb.b);
    var vals = { r: rgb.r, g: rgb.g, b: rgb.b, c: cmyk.c, m: cmyk.m, y: cmyk.y, k: cmyk.k };
    Array.prototype.forEach.call(el.querySelectorAll('[data-k]'), function (inp) {
      if (document.activeElement !== inp) inp.value = vals[inp.getAttribute('data-k')];
    });

    st.hex = hex;
    if (st.onChange) st.onChange(hex);
  }

  function setFromHex(hex) {
    var rgb = hexToRgb(hex);
    if (!rgb) return false;
    var hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
    pickerState.h = hsv.s < 0.001 ? pickerState.h : hsv.h;
    pickerState.s = hsv.s;
    pickerState.v = hsv.v;
    return true;
  }

  function closePicker(commit) {
    if (!pickerEl) return;
    var st = pickerState;
    pickerEl.style.display = 'none';
    if (st) {
      if (commit) { if (st.onDone) st.onDone(st.hex); }
      else if (st.onChange) st.onChange(st.start);
    }
    pickerState = null;
  }

  function wirePicker() {
    var el = pickerEl;
    var sv = el.querySelector('.xo-picker__sv');
    var hue = el.querySelector('.xo-picker__hue');
    var dragging = null;

    function svAt(e) {
      var b = sv.getBoundingClientRect();
      var pt = e.touches && e.touches.length ? e.touches[0] : e;
      pickerState.s = Math.max(0, Math.min(1, (pt.clientX - b.left) / b.width));
      pickerState.v = 1 - Math.max(0, Math.min(1, (pt.clientY - b.top) / b.height));
      paintPicker();
    }
    function hueAt(e) {
      var b = hue.getBoundingClientRect();
      var pt = e.touches && e.touches.length ? e.touches[0] : e;
      pickerState.h = Math.max(0, Math.min(1, (pt.clientY - b.top) / b.height)) * 360;
      paintPicker();
    }

    sv.addEventListener('mousedown', function (e) { dragging = svAt; svAt(e); });
    hue.addEventListener('mousedown', function (e) { dragging = hueAt; hueAt(e); });
    sv.addEventListener('touchstart', function (e) { dragging = svAt; svAt(e); }, { passive: true });
    hue.addEventListener('touchstart', function (e) { dragging = hueAt; hueAt(e); }, { passive: true });
    window.addEventListener('mousemove', function (e) {
      if (dragging && pickerState) { e.preventDefault(); dragging(e); }
    });
    window.addEventListener('touchmove', function (e) {
      if (dragging && pickerState) dragging(e);
    }, { passive: true });
    window.addEventListener('mouseup', function () { dragging = null; });
    window.addEventListener('touchend', function () { dragging = null; });

    var hexIn = el.querySelector('.xo-picker__hex input');
    hexIn.addEventListener('input', function () {
      if (!pickerState) return;
      if (setFromHex(hexIn.value)) paintPicker();
    });

    Array.prototype.forEach.call(el.querySelectorAll('[data-k]'), function (inp) {
      inp.addEventListener('input', function () {
        if (!pickerState) return;
        var mode = inp.parentNode.parentNode.getAttribute('data-mode');
        var read = function (k) {
          var f = el.querySelector('[data-k="' + k + '"]');
          return parseFloat(f.value) || 0;
        };
        var rgb = mode === 'rgb'
          ? { r: read('r'), g: read('g'), b: read('b') }
          : cmykToRgb(read('c'), read('m'), read('y'), read('k'));
        setFromHex(rgbToHex(rgb.r, rgb.g, rgb.b));
        paintPicker();
      });
    });

    el.querySelector('.xo-picker__ok').addEventListener('click', function () { closePicker(true); });
    el.querySelector('.xo-picker__cancel').addEventListener('click', function () { closePicker(false); });

    document.addEventListener('mousedown', function (e) {
      if (!pickerState) return;
      if (el.contains(e.target)) return;
      if (pickerState.trigger && pickerState.trigger.contains(e.target)) return;
      closePicker(true);
    });
    document.addEventListener('keydown', function (e) {
      if (pickerState && e.key === 'Escape') closePicker(false);
    });
  }

  /* open({ hex, trigger, onChange, onDone }) - onChange fires live as the
     colour moves, onDone when it is accepted. */
  var XOColour = window.XOColour = {
    open: function (opts) {
      if (!pickerEl) { pickerEl = buildPicker(); wirePicker(); }
      pickerEl.style.display = 'block';

      pickerState = {
        h: 0, s: 1, v: 1,
        start: opts.hex || '#FFFFFF',
        hex: opts.hex || '#FFFFFF',
        trigger: opts.trigger || null,
        onChange: opts.onChange || null,
        onDone: opts.onDone || null
      };
      if (!setFromHex(opts.hex)) setFromHex('#FFFFFF');

      /* Sit under the control that opened it, nudged back on screen if that
         would push it off the edge. */
      var t = opts.trigger;
      var w = 268, h = 330;
      var x = 20, y = 20;
      if (t) {
        var b = t.getBoundingClientRect();
        x = Math.min(window.innerWidth - w - 12, Math.max(12, b.left));
        y = b.bottom + 8;
        if (y + h > window.innerHeight - 12) y = Math.max(12, b.top - h - 8);
      }
      pickerEl.style.left = Math.round(x) + 'px';
      pickerEl.style.top = Math.round(y) + 'px';

      paintPicker();
    },
    close: function () { closePicker(false); },
    hexToRgb: hexToRgb,
    rgbToHex: rgbToHex,
    rgbToCmyk: rgbToCmyk,
    cmykToRgb: cmykToRgb
  };

  /* =======================================================================
     How light or dark is the garment where a print will sit?
     -----------------------------------------------------------------------
     Returns 0 (black) to 1 (white) for the patch of photo under a spot, so
     the caller can put white ink on a navy coverall and black ink on a yellow
     vest without anyone having to think about it.
     ======================================================================= */
  function patchLuminance(img, spot) {
    var W = 140;
    var H = Math.max(1, Math.round(img.height / img.width * W));
    var cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    var ctx = cv.getContext('2d');
    ctx.drawImage(img, 0, 0, W, H);

    var halfW = (spot.w || 0.2) / 2;
    var halfH = (spot.hMax || 0.2) / 2;
    var x0 = Math.max(0, Math.round((spot.x - halfW) * W));
    var x1 = Math.min(W, Math.round((spot.x + halfW) * W));
    var y0 = Math.max(0, Math.round((spot.y - halfH) * H));
    var y1 = Math.min(H, Math.round((spot.y + halfH) * H));
    if (x1 <= x0) { x0 = Math.max(0, x0 - 1); x1 = x0 + 1; }
    if (y1 <= y0) { y0 = Math.max(0, y0 - 1); y1 = y0 + 1; }

    var d;
    try { d = ctx.getImageData(x0, y0, x1 - x0, y1 - y0).data; }
    catch (e) { return 0.5; }

    var sum = 0, n = 0;
    for (var i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 40) continue;
      sum += (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255;
      n++;
    }
    return n ? sum / n : 0.5;
  }

  /* White on a dark garment, near-black on a light one. The thresholds leave
     a gap so a mid-tone does not flip between the two on a small change. */
  function inkFor(img, spot) {
    return patchLuminance(img, spot) > 0.52 ? '#111111' : '#FFFFFF';
  }

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
    patchLuminance: patchLuminance,
    inkFor: inkFor,
    tintImage: tintImage,
    logoPalette: logoPalette,
    recolourImage: recolourImage,
    logoSource: logoSource,
    layerAt: layerAt,
    addTextLayer: addTextLayer,
    autoLayers: autoLayers,
    fontFor: fontFor,
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
