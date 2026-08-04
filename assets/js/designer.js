/* =========================================================================
   XpertOne Prints — Product designer
   -------------------------------------------------------------------------
   Lets the customer put their own logo and text onto a product before it
   goes in the cart, and see exactly how it will look.

     - upload a logo, background removed automatically in the browser
     - type the text in English and in Arabic
     - choose where it goes and what colour it prints
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
      if (d.en) bits.push('English text: "' + d.en + '"');
      if (d.ar) bits.push('Arabic text: "' + d.ar + '"');
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

  /* =======================================================================
     Mockup rendering
     ======================================================================= */
  var SIZE = 760;

  function anchorFor(placement) {
    var a = CFG.PRINTING.anchors || {};
    return a[placement] || a._default || { x: 0.5, y: 0.44, w: 0.30 };
  }

  function drawMockup(canvas, productImg, design) {
    var ctx = canvas.getContext('2d');
    canvas.width = SIZE;
    canvas.height = SIZE;

    ctx.fillStyle = '#F6F7F9';
    ctx.fillRect(0, 0, SIZE, SIZE);

    /* Product photo, contained and centred. */
    var pad = SIZE * 0.05;
    var box = SIZE - pad * 2;
    var s = Math.min(box / productImg.width, box / productImg.height);
    var pw = productImg.width * s, ph = productImg.height * s;
    ctx.drawImage(productImg, (SIZE - pw) / 2, (SIZE - ph) / 2, pw, ph);

    var a = anchorFor(design.placement);
    var cx = SIZE * a.x;
    var cy = SIZE * a.y;
    var maxW = SIZE * a.w;

    var colour = design.inkColour || '#111111';
    var cursorY = cy;

    /* Logo */
    if (design._logoImg) {
      var li = design._logoImg;
      var ls = Math.min(maxW / li.width, (SIZE * a.w * 0.9) / li.height);
      var lw = li.width * ls, lh = li.height * ls;
      ctx.drawImage(li, cx - lw / 2, cursorY - lh / 2, lw, lh);
      cursorY += lh / 2 + SIZE * 0.018;
    } else {
      cursorY -= SIZE * 0.01;
    }

    /* Text */
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = colour;

    function fit(text, font, weight, startPx, dir) {
      var px = startPx;
      ctx.direction = dir || 'ltr';
      do {
        ctx.font = weight + ' ' + px + 'px ' + font;
        if (ctx.measureText(text).width <= maxW || px <= 10) break;
        px -= 1;
      } while (true);
      return px;
    }

    if (design.en) {
      var pxEn = fit(design.en, "'Inter', Arial, sans-serif", '700', Math.round(SIZE * 0.042), 'ltr');
      ctx.font = '700 ' + pxEn + "px 'Inter', Arial, sans-serif";
      ctx.direction = 'ltr';
      ctx.fillText(design.en, cx, cursorY);
      cursorY += pxEn * 1.25;
    }

    if (design.ar) {
      var arFont = "'Noto Sans Arabic', 'Segoe UI', Tahoma, Arial, sans-serif";
      var pxAr = fit(design.ar, arFont, '700', Math.round(SIZE * 0.042), 'rtl');
      ctx.font = '700 ' + pxAr + 'px ' + arFont;
      ctx.direction = 'rtl';
      ctx.fillText(design.ar, cx, cursorY);
      cursorY += pxAr * 1.3;
    }

    ctx.direction = 'ltr';
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
      removedBg: false,
      en: '',
      ar: '',
      placement: CFG.PRINTING.placements[0],
      colour: 'White',
      inkColour: '#FFFFFF'
    };
    var logoImg = null;
    var productImg = null;
    var busy = false;

    mount.innerHTML =
      '<div class="designer">' +

        '<div class="designer__head">' +
          '<div>' +
            '<b>Add your logo and text</b>' +
            '<span>Upload once, see it on the product straight away.</span>' +
          '</div>' +
          '<label class="switch">' +
            '<input type="checkbox" id="dsOn"><span>Customise this item</span>' +
          '</label>' +
        '</div>' +

        '<div id="dsBody" hidden>' +
          '<div class="row g-3">' +

            '<div class="col-lg-6">' +
              '<div class="designer__preview">' +
                '<canvas id="dsCanvas" aria-label="Preview of your design on the product"></canvas>' +
                '<div class="designer__spinner" id="dsSpin" hidden>' +
                  '<i class="fa-solid fa-circle-notch fa-spin"></i> Removing background…</div>' +
              '</div>' +
              '<p class="form-text text-center mb-0">Preview only — we send a production proof before printing.</p>' +
            '</div>' +

            '<div class="col-lg-6">' +

              '<label class="form-label" for="dsFile">Your logo</label>' +
              '<input class="form-control" type="file" id="dsFile" accept="image/png,image/jpeg,image/webp,image/svg+xml">' +
              '<div class="form-check mt-2">' +
                '<input class="form-check-input" type="checkbox" id="dsCut" checked>' +
                '<label class="form-check-label" for="dsCut" style="font-size:.88rem">' +
                  'Remove the background automatically</label>' +
              '</div>' +
              '<p class="form-text mb-0" id="dsFileNote">PNG, JPG or WebP. Works best on a plain background.</p>' +

              '<label class="form-label mt-3" for="dsEn">Text in English</label>' +
              '<input class="form-control" id="dsEn" maxlength="40" placeholder="AL FAJER CONTRACTING">' +

              '<label class="form-label mt-3" for="dsAr">النص بالعربية</label>' +
              '<input class="form-control" id="dsAr" maxlength="40" dir="rtl" lang="ar" ' +
                'style="font-family:\'Noto Sans Arabic\',Tahoma,Arial,sans-serif" placeholder="الفجر للمقاولات">' +

              '<div class="row g-2 mt-1">' +
                '<div class="col-7">' +
                  '<label class="form-label" for="dsPlace">Placement</label>' +
                  '<select class="form-select" id="dsPlace">' +
                    CFG.PRINTING.placements.map(function (p) {
                      return '<option>' + XO.esc(p) + '</option>';
                    }).join('') +
                  '</select>' +
                '</div>' +
                '<div class="col-5">' +
                  '<label class="form-label" for="dsColour">Print colour</label>' +
                  '<select class="form-select" id="dsColour">' +
                    (CFG.PRINTING.inkColours || []).map(function (c) {
                      return '<option value="' + c.hex + '">' + XO.esc(c.name) + '</option>';
                    }).join('') +
                  '</select>' +
                '</div>' +
              '</div>' +

              '<div class="d-flex flex-wrap gap-2 mt-3">' +
                '<button class="btn btn-outline-xo btn-sm-xo" type="button" id="dsDownload">' +
                  '<i class="fa-solid fa-download"></i> Save this preview</button>' +
                '<button class="btn btn-outline-xo btn-sm-xo" type="button" id="dsReset">' +
                  '<i class="fa-solid fa-rotate-left"></i> Start again</button>' +
              '</div>' +

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
      en: XO.el('#dsEn', mount),
      ar: XO.el('#dsAr', mount),
      place: XO.el('#dsPlace', mount),
      colour: XO.el('#dsColour', mount),
      download: XO.el('#dsDownload', mount),
      reset: XO.el('#dsReset', mount)
    };

    function repaint() {
      if (!productImg) return;
      state._logoImg = logoImg;
      drawMockup(el.canvas, productImg, state);
      if (typeof opts.onChange === 'function') opts.onChange(active());
    }

    function active() {
      return el.on.checked && !!(state.logo || state.en || state.ar);
    }

    loadImage(product.images[0], true)
      .then(function (img) { productImg = img; repaint(); })
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

          out = downscale(out, 700);
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
              el.note.innerHTML = '<span style="color:var(--xo-success)"><i class="fa-solid fa-circle-check"></i> ' +
                XO.esc(file.name) + ' added' + (state.removedBg ? ', background removed' : '') + '.</span>';
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

    el.en.addEventListener('input', function () { state.en = el.en.value.trim(); repaint(); });
    el.ar.addEventListener('input', function () { state.ar = el.ar.value.trim(); repaint(); });
    el.place.addEventListener('change', function () { state.placement = el.place.value; repaint(); });
    el.colour.addEventListener('change', function () {
      state.inkColour = el.colour.value;
      state.colour = el.colour.options[el.colour.selectedIndex].text;
      repaint();
    });

    el.download.addEventListener('click', function () {
      var a = document.createElement('a');
      a.href = el.canvas.toDataURL('image/png');
      a.download = XO.slug(product.title) + '-design.png';
      a.click();
    });

    el.reset.addEventListener('click', function () {
      state.logo = ''; state.logoName = ''; state.en = ''; state.ar = '';
      logoImg = null;
      el.file.value = ''; el.en.value = ''; el.ar.value = '';
      el.note.textContent = 'PNG, JPG or WebP. Works best on a plain background.';
      repaint();
    });

    return {
      isActive: active,
      isBusy: function () { return busy; },
      design: function () {
        if (!active()) return null;
        var mockup = '';
        try { mockup = el.canvas.toDataURL('image/jpeg', 0.72); } catch (e) {}
        return {
          product: product.title,
          logo: state.logo,
          logoName: state.logoName,
          removedBg: state.removedBg,
          en: state.en,
          ar: state.ar,
          placement: state.placement,
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
