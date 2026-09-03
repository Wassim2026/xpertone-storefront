/* =========================================================================
   Xpertone Creative LLC-FZ — pack.js
   -------------------------------------------------------------------------
   Builds a ZIP file and a PDF catalogue in the browser, with no external
   library. Everything here is plain ES5 and runs offline.

   XOPack.zip(files)        -> Blob   files: [{ name, data (Uint8Array) }]
   XOPack.pdf(pages, meta)  -> Blob   pages: [{ jpeg (Uint8Array), w, h,
                                                title, lines[] }]

   The ZIP is written with no compression. Every file we put in one is a PNG
   or a JPEG, which is already compressed — deflating it again would cost
   time and save nothing.
   ========================================================================= */

(function () {
  'use strict';

  /* =======================================================================
     Byte helpers
     ======================================================================= */

  /* Text goes in as Latin-1. Anything outside it is transliterated before it
     reaches here, so a stray character can never shift a byte offset. */
  function bytes(str) {
    var out = new Uint8Array(str.length);
    for (var i = 0; i < str.length; i++) out[i] = str.charCodeAt(i) & 0xFF;
    return out;
  }

  function utf8(str) {
    if (window.TextEncoder) return new TextEncoder().encode(str);
    var s = unescape(encodeURIComponent(str));
    return bytes(s);
  }

  function concat(list) {
    var n = 0, i;
    for (i = 0; i < list.length; i++) n += list[i].length;
    var out = new Uint8Array(n), at = 0;
    for (i = 0; i < list.length; i++) { out.set(list[i], at); at += list[i].length; }
    return out;
  }

  /* =======================================================================
     CRC-32 — required by the ZIP format
     ======================================================================= */
  var CRC_TABLE = (function () {
    var t = new Uint32Array(256);
    for (var n = 0; n < 256; n++) {
      var c = n;
      for (var k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[n] = c >>> 0;
    }
    return t;
  })();

  function crc32(u8) {
    var c = 0xFFFFFFFF;
    for (var i = 0; i < u8.length; i++) c = CRC_TABLE[(c ^ u8[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  /* =======================================================================
     ZIP
     ======================================================================= */

  function dosTime(d) {
    return ((d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)) & 0xFFFF;
  }
  function dosDate(d) {
    return (((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()) & 0xFFFF;
  }

  function u16(v) { return new Uint8Array([v & 0xFF, (v >>> 8) & 0xFF]); }
  function u32(v) {
    return new Uint8Array([v & 0xFF, (v >>> 8) & 0xFF, (v >>> 16) & 0xFF, (v >>> 24) & 0xFF]);
  }

  function zip(files) {
    var now = new Date();
    var t = dosTime(now), dt = dosDate(now);
    var parts = [], central = [], offset = 0;

    files.forEach(function (f) {
      var name = utf8(f.name);
      var data = f.data;
      var crc = crc32(data);

      var local = concat([
        u32(0x04034B50),
        u16(20),          // version needed
        u16(0x0800),      // flags: names are UTF-8
        u16(0),           // method: stored
        u16(t), u16(dt),
        u32(crc), u32(data.length), u32(data.length),
        u16(name.length), u16(0),
        name
      ]);

      parts.push(local, data);

      central.push(concat([
        u32(0x02014B50),
        u16(20), u16(20), u16(0x0800), u16(0),
        u16(t), u16(dt),
        u32(crc), u32(data.length), u32(data.length),
        u16(name.length), u16(0), u16(0),
        u16(0), u16(0), u32(0),
        u32(offset),
        name
      ]));

      offset += local.length + data.length;
    });

    var dir = concat(central);
    var end = concat([
      u32(0x06054B50),
      u16(0), u16(0),
      u16(files.length), u16(files.length),
      u32(dir.length), u32(offset),
      u16(0)
    ]);

    return new Blob([concat(parts), dir, end], { type: 'application/zip' });
  }

  /* =======================================================================
     PDF
     -----------------------------------------------------------------------
     One A4 page per product: a header rule, the branded mockup, and the
     product name and details underneath. The mockup already carries any
     Arabic, so the text drawn here only ever needs Latin-1.
     ======================================================================= */

  var PW = 595.28, PH = 841.89;

  /* Fold anything outside Latin-1 down to something a PDF base font can
     show, so a name typed in Arabic never produces broken glyphs. */
  function latin(s) {
    var out = '';
    s = String(s == null ? '' : s);
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i);
      if (c === 0x2019 || c === 0x2018) out += "'";
      else if (c === 0x201C || c === 0x201D) out += '"';
      else if (c === 0x2013 || c === 0x2014) out += '-';
      else if (c === 0x00B7 || c === 0x2022) out += '-';
      else if (c >= 32 && c < 256) out += s.charAt(i);
      else if (c > 255) out += '';
    }
    return out;
  }

  function pdfStr(s) {
    return '(' + latin(s).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)') + ')';
  }

  function pad10(n) {
    var s = String(n);
    while (s.length < 10) s = '0' + s;
    return s;
  }

  function pdf(pages, meta) {
    meta = meta || {};
    var chunks = [], len = 0;
    var offsets = [];              // offsets[objNumber] = byte offset

    function put(u8) { chunks.push(u8); len += u8.length; }
    function putStr(s) { put(bytes(s)); }

    function startObj(n) { offsets[n] = len; putStr(n + ' 0 obj\n'); }
    function endObj() { putStr('\nendobj\n'); }

    putStr('%PDF-1.4\n');
    put(new Uint8Array([0x25, 0xE2, 0xE3, 0xCF, 0xD3, 0x0A]));

    /* Object numbering: 1 catalog, 2 pages, 3 regular font, 4 bold font,
       then three objects per page. */
    var FIRST = 5;
    var kids = pages.map(function (_, i) { return (FIRST + i * 3) + ' 0 R'; }).join(' ');
    var last = FIRST + pages.length * 3 - 1;
    var total = Math.max(4, last);

    startObj(1);
    putStr('<< /Type /Catalog /Pages 2 0 R >>');
    endObj();

    startObj(2);
    putStr('<< /Type /Pages /Count ' + pages.length + ' /Kids [' + kids + '] >>');
    endObj();

    startObj(3);
    putStr('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    endObj();

    startObj(4);
    putStr('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
    endObj();

    pages.forEach(function (p, i) {
      var nPage = FIRST + i * 3;
      var nCont = nPage + 1;
      var nImg = nPage + 2;

      /* Fit the mockup into the middle of the page. */
      var maxW = PW - 90;
      var maxH = PH - 250;
      var s = Math.min(maxW / p.w, maxH / p.h);
      var w = p.w * s, h = p.h * s;
      var x = (PW - w) / 2;
      var y = PH - 150 - h;

      var ops = [];
      ops.push('q 0.06 0.07 0.09 rg 0 ' + (PH - 78).toFixed(2) + ' ' + PW.toFixed(2) + ' 78 re f Q');
      ops.push('BT /F2 19 Tf 1 1 1 rg 42 ' + (PH - 42).toFixed(2) + ' Td ' +
        pdfStr(meta.company || 'Branded workwear') + ' Tj ET');
      ops.push('BT /F1 10 Tf 0.78 0.80 0.84 rg 42 ' + (PH - 60).toFixed(2) + ' Td ' +
        pdfStr(meta.subhead || '') + ' Tj ET');

      ops.push('q ' + w.toFixed(2) + ' 0 0 ' + h.toFixed(2) + ' ' +
        x.toFixed(2) + ' ' + y.toFixed(2) + ' cm /Im0 Do Q');

      var ty = y - 32;
      ops.push('BT /F2 15 Tf 0.06 0.07 0.09 rg 42 ' + ty.toFixed(2) + ' Td ' + pdfStr(p.title) + ' Tj ET');
      (p.lines || []).forEach(function (line, k) {
        ops.push('BT /F1 10.5 Tf 0.36 0.39 0.44 rg 42 ' + (ty - 18 - k * 14).toFixed(2) +
          ' Td ' + pdfStr(line) + ' Tj ET');
      });

      ops.push('q 0.88 0.89 0.91 RG 0.8 w 42 46 m ' + (PW - 42).toFixed(2) + ' 46 l S Q');
      ops.push('BT /F1 8.5 Tf 0.53 0.56 0.60 rg 42 32 Td ' +
        pdfStr((meta.footer || '') + '   ·   Page ' + (i + 1) + ' of ' + pages.length) + ' Tj ET');

      var stream = utf8(ops.join('\n'));

      startObj(nPage);
      putStr('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + PW.toFixed(2) + ' ' + PH.toFixed(2) + '] ' +
        '/Resources << /Font << /F1 3 0 R /F2 4 0 R >> /XObject << /Im0 ' + nImg + ' 0 R >> >> ' +
        '/Contents ' + nCont + ' 0 R >>');
      endObj();

      startObj(nCont);
      putStr('<< /Length ' + stream.length + ' >>\nstream\n');
      put(stream);
      putStr('\nendstream');
      endObj();

      startObj(nImg);
      putStr('<< /Type /XObject /Subtype /Image /Width ' + p.w + ' /Height ' + p.h +
        ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' +
        p.jpeg.length + ' >>\nstream\n');
      put(p.jpeg);
      putStr('\nendstream');
      endObj();
    });

    /* Cross-reference table */
    var xrefAt = len;
    putStr('xref\n0 ' + (total + 1) + '\n');
    putStr('0000000000 65535 f \n');
    for (var n = 1; n <= total; n++) {
      putStr(pad10(offsets[n] || 0) + ' 00000 n \n');
    }
    putStr('trailer\n<< /Size ' + (total + 1) + ' /Root 1 0 R /Info << ' +
      '/Title ' + pdfStr(meta.title || 'Branded workwear') +
      ' /Producer ' + pdfStr('Xpertone Creative LLC-FZ brand kit') + ' >> >>\n');
    putStr('startxref\n' + xrefAt + '\n%%EOF\n');

    return new Blob([concat(chunks)], { type: 'application/pdf' });
  }

  /* =======================================================================
     XLSX
     -----------------------------------------------------------------------
     A real Excel workbook, built from the ZIP writer above. Strings go in
     inline rather than through a shared-strings table, which costs a few
     bytes and saves a whole moving part.

     xlsx([{ name, rows: [[cell, cell, ...], ...], widths: [n, ...] }])
     ======================================================================= */

  function colName(n) {
    var s = '';
    n += 1;
    while (n > 0) {
      var r = (n - 1) % 26;
      s = String.fromCharCode(65 + r) + s;
      n = Math.floor((n - 1) / 26);
    }
    return s;
  }

  function xmlEsc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&apos;')
      /* Control characters are illegal in XML and Excel refuses the file. */
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
  }

  function sheetXml(sheet) {
    var rows = sheet.rows || [];
    var cols = '';
    if (sheet.widths && sheet.widths.length) {
      cols = '<cols>' + sheet.widths.map(function (w, i) {
        return '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + w + '" customWidth="1"/>';
      }).join('') + '</cols>';
    }

    var body = rows.map(function (row, r) {
      var cells = (row || []).map(function (v, c) {
        var ref = colName(c) + (r + 1);
        var style = r === 0 ? ' s="1"' : '';
        if (typeof v === 'number' && isFinite(v)) {
          return '<c r="' + ref + '"' + style + '><v>' + v + '</v></c>';
        }
        if (v == null || v === '') return '<c r="' + ref + '"' + style + '/>';
        return '<c r="' + ref + '"' + style + ' t="inlineStr"><is><t xml:space="preserve">' +
          xmlEsc(v) + '</t></is></c>';
      }).join('');
      return '<row r="' + (r + 1) + '">' + cells + '</row>';
    }).join('');

    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      cols + '<sheetData>' + body + '</sheetData></worksheet>';
  }

  function xlsx(sheets) {
    sheets = sheets && sheets.length ? sheets : [{ name: 'Sheet1', rows: [] }];

    var types = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
      sheets.map(function (s, i) {
        return '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ' +
          'ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>';
      }).join('') +
      '</Types>';

    var rels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
      '</Relationships>';

    var wb = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
      'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' +
      sheets.map(function (s, i) {
        return '<sheet name="' + xmlEsc((s.name || ('Sheet' + (i + 1))).slice(0, 31)) +
          '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>';
      }).join('') +
      '</sheets></workbook>';

    var wbRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      sheets.map(function (s, i) {
        return '<Relationship Id="rId' + (i + 1) + '" ' +
          'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" ' +
          'Target="worksheets/sheet' + (i + 1) + '.xml"/>';
      }).join('') +
      '<Relationship Id="rId' + (sheets.length + 1) + '" ' +
      'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
      '</Relationships>';

    /* Two formats: plain, and bold on a light fill for the header row. */
    var styles = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<fonts count="2">' +
      '<font><sz val="11"/><name val="Calibri"/></font>' +
      '<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>' +
      '</fonts>' +
      '<fills count="3">' +
      '<fill><patternFill patternType="none"/></fill>' +
      '<fill><patternFill patternType="gray125"/></fill>' +
      '<fill><patternFill patternType="solid"><fgColor rgb="FF0E1116"/><bgColor indexed="64"/></patternFill></fill>' +
      '</fills>' +
      '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
      '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
      '<cellXfs count="2">' +
      '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
      '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>' +
      '</cellXfs>' +
      '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
      '</styleSheet>';

    var files = [
      { name: '[Content_Types].xml', data: utf8(types) },
      { name: '_rels/.rels', data: utf8(rels) },
      { name: 'xl/workbook.xml', data: utf8(wb) },
      { name: 'xl/_rels/workbook.xml.rels', data: utf8(wbRels) },
      { name: 'xl/styles.xml', data: utf8(styles) }
    ];
    sheets.forEach(function (s, i) {
      files.push({ name: 'xl/worksheets/sheet' + (i + 1) + '.xml', data: utf8(sheetXml(s)) });
    });

    var blob = zip(files);
    return new Blob([blob], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
  }

  /* =======================================================================
     Small conveniences
     ======================================================================= */

  function blobToU8(blob) {
    return new Promise(function (resolve, reject) {
      if (blob.arrayBuffer) {
        blob.arrayBuffer().then(function (b) { resolve(new Uint8Array(b)); }, reject);
        return;
      }
      var fr = new FileReader();
      fr.onload = function () { resolve(new Uint8Array(fr.result)); };
      fr.onerror = function () { reject(new Error('Could not read the image')); };
      fr.readAsArrayBuffer(blob);
    });
  }

  function canvasBlob(canvas, type, quality) {
    return new Promise(function (resolve, reject) {
      if (canvas.toBlob) {
        canvas.toBlob(function (b) {
          if (b) resolve(b); else reject(new Error('Could not export the preview'));
        }, type, quality);
      } else {
        var url = canvas.toDataURL(type, quality);
        var bin = atob(url.split(',')[1]);
        var u8 = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
        resolve(new Blob([u8], { type: type }));
      }
    });
  }

  function download(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 1500);
  }

  window.XOPack = {
    zip: zip,
    pdf: pdf,
    xlsx: xlsx,
    crc32: crc32,
    utf8: utf8,
    blobToU8: blobToU8,
    canvasBlob: canvasBlob,
    download: download,
    latin: latin
  };
})();
