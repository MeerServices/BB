/* BB — streepjescodes lezen (met verbeteraar) en tekenen. Gedeeld door Statiegeld en Cadeau. */
(() => {
  "use strict";
  // ---------- bibliotheken (meegeleverd in /vendor, pas laden als ze nodig zijn) ----------
  const loaded = {};
  const loadScript = (src) => loaded[src] || (loaded[src] = new Promise((res, rej) => { const s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = () => { delete loaded[src]; rej(new Error(src)); }; document.head.appendChild(s); }));
  const loadZXing = () => window.ZXing ? Promise.resolve() : loadScript("vendor/zxing-0.21.3.min.js");
  const loadJsBarcode = () => window.JsBarcode ? Promise.resolve() : loadScript("vendor/jsbarcode-3.11.6.min.js");

  // ---------- streepjescode tekenen ----------
  const JSB = { EAN_13: "EAN13", EAN_8: "EAN8", UPC_A: "UPC", UPC_E: "UPCE", CODE_128: "CODE128", CODE_39: "CODE39", ITF: "ITF", CODABAR: "codabar" };
  function guessFormat(nr) {
    if (/^\d{13}$/.test(nr) && eanOk(nr)) return "EAN_13";
    if (/^\d{8}$/.test(nr) && eanOk(nr)) return "EAN_8";
    if (/^\d{12}$/.test(nr) && eanOk("0" + nr)) return "UPC_A";
    return "CODE_128";
  }
  function eanOk(nr) {
    const d = nr.split("").map(Number), check = d.pop();
    const sum = d.reverse().reduce((s, x, i) => s + x * (i % 2 === 0 ? 3 : 1), 0);
    return (10 - (sum % 10)) % 10 === check;
  }
  async function drawBarcode(box, nr, formaat, big) {
    box.innerHTML = ""; if (!nr) return;
    try { await loadJsBarcode(); } catch (e) { box.textContent = nr; return; }
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    const opts = { displayValue: true, font: "IBM Plex Mono, monospace", fontSize: big ? 20 : 16, height: big ? 110 : 70, width: big ? 2.4 : 2, margin: 4, background: "#ffffff", lineColor: "#000000" };
    try { JsBarcode(svg, nr, { ...opts, format: JSB[formaat] || "CODE128" }); }
    catch (e) { try { JsBarcode(svg, nr, { ...opts, format: "CODE128" }); } catch (e2) { box.textContent = nr; return; } }
    box.appendChild(svg);
  }

  async function miniBarcode(box, nr, formaat) {
    try { await loadJsBarcode(); } catch (e) { return; }
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    try { JsBarcode(svg, nr, { format: JSB[formaat] || "CODE128", displayValue: false, height: 40, width: 1, margin: 0 }); }
    catch (e) { try { JsBarcode(svg, nr, { format: "CODE128", displayValue: false, height: 40, width: 1, margin: 0 }); } catch (e2) { return; } }
    svg.setAttribute("preserveAspectRatio", "none"); box.appendChild(svg);
  }

  // ---------- streepjescode lezen, met verbeteraar ----------
  // Probeert eerst de ingebouwde BarcodeDetector van de telefoon, daarna ZXing op een reeks
  // bewerkte versies van de foto: grijs, meer contrast, zwart-wit, scherper, gedraaid en in stroken.
  let detector = null;
  async function nativeDetect(canvas) {
    if (!("BarcodeDetector" in window)) return null;
    try {
      if (!detector) { const f = await BarcodeDetector.getSupportedFormats(); detector = new BarcodeDetector({ formats: f.filter((x) => x !== "qr_code" || true) }); }
      const r = await detector.detect(canvas);
      if (r && r[0] && r[0].rawValue) return { text: r[0].rawValue, formaat: String(r[0].format || "").toUpperCase() };
    } catch (e) {}
    return null;
  }
  let reader = null;
  function zxingDecode(canvas) {
    const Z = window.ZXing;
    if (!reader) {
      reader = new Z.MultiFormatReader();
      const hints = new Map();
      hints.set(Z.DecodeHintType.TRY_HARDER, true);
      hints.set(Z.DecodeHintType.POSSIBLE_FORMATS, [Z.BarcodeFormat.EAN_13, Z.BarcodeFormat.EAN_8, Z.BarcodeFormat.UPC_A, Z.BarcodeFormat.UPC_E, Z.BarcodeFormat.CODE_128, Z.BarcodeFormat.CODE_39, Z.BarcodeFormat.ITF, Z.BarcodeFormat.CODABAR, Z.BarcodeFormat.QR_CODE]);
      reader.setHints(hints);
    }
    const src = new Z.HTMLCanvasElementLuminanceSource(canvas);
    for (const Bin of [Z.HybridBinarizer, Z.GlobalHistogramBinarizer]) {
      try { const r = reader.decode(new Z.BinaryBitmap(new Bin(src))); return { text: r.getText(), formaat: Z.BarcodeFormat[r.getBarcodeFormat()] }; }
      catch (e) { reader.reset(); }
    }
    return null;
  }
  function canvasFrom(source, sx, sy, sw, sh, maxW, rotate) {
    const scale = Math.min(maxW / sw, 2.5);
    const w = Math.round(sw * scale), h = Math.round(sh * scale);
    const c = document.createElement("canvas");
    if (rotate) { c.width = h; c.height = w; } else { c.width = w; c.height = h; }
    const x = c.getContext("2d", { willReadFrequently: true });
    x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height);
    if (rotate) { x.translate(h, 0); x.rotate(Math.PI / 2); }
    x.drawImage(source, sx, sy, sw, sh, 0, 0, w, h);
    return c;
  }
  function filter(c, mode) {
    const x = c.getContext("2d", { willReadFrequently: true }), img = x.getImageData(0, 0, c.width, c.height), d = img.data, n = d.length / 4;
    const g = new Uint8ClampedArray(n);
    for (let i = 0; i < n; i++) g[i] = (d[i * 4] * 299 + d[i * 4 + 1] * 587 + d[i * 4 + 2] * 114) / 1000;
    let out = g;
    if (mode === "contrast" || mode === "bw") {
      const hist = new Uint32Array(256); g.forEach((v) => hist[v]++);
      let lo = 0, hi = 255, acc = 0; const cut = n * 0.02;
      for (; lo < 255 && (acc += hist[lo]) < cut; lo++); acc = 0;
      for (; hi > 0 && (acc += hist[hi]) < cut; hi--);
      const span = Math.max(1, hi - lo);
      out = g.map((v) => Math.max(0, Math.min(255, ((v - lo) * 255) / span)));
      if (mode === "bw") {
        // Otsu-drempel
        const h2 = new Uint32Array(256); out.forEach((v) => h2[v]++);
        let sum = 0; for (let t = 0; t < 256; t++) sum += t * h2[t];
        let sB = 0, wB = 0, best = 0, thr = 128;
        for (let t = 0; t < 256; t++) { wB += h2[t]; if (!wB) continue; const wF = n - wB; if (!wF) break; sB += t * h2[t]; const mB = sB / wB, mF = (sum - sB) / wF, between = wB * wF * (mB - mF) ** 2; if (between > best) { best = between; thr = t; } }
        out = out.map((v) => (v > thr ? 255 : 0));
      }
    } else if (mode === "vsmooth") {
      // Verticaal uitsmeren: ruis verdwijnt, de verticale streepjes blijven scherp. Daarna contrast oprekken.
      const w = c.width, h = c.height, R = 6, o = new Uint8ClampedArray(n);
      for (let x2 = 0; x2 < w; x2++) {
        let acc = 0, cnt = 0;
        for (let y = 0; y < Math.min(R, h); y++) { acc += g[y * w + x2]; cnt++; }
        for (let y = 0; y < h; y++) {
          if (y + R < h) { acc += g[(y + R) * w + x2]; cnt++; }
          if (y - R - 1 >= 0) { acc -= g[(y - R - 1) * w + x2]; cnt--; }
          o[y * w + x2] = acc / cnt;
        }
      }
      const hist = new Uint32Array(256); o.forEach((v) => hist[v]++);
      let lo = 0, hi = 255, a2 = 0; const cut = n * 0.02;
      for (; lo < 255 && (a2 += hist[lo]) < cut; lo++); a2 = 0;
      for (; hi > 0 && (a2 += hist[hi]) < cut; hi--);
      const span = Math.max(1, hi - lo);
      out = o.map((v) => Math.max(0, Math.min(255, ((v - lo) * 255) / span)));
    } else if (mode === "sharp") {
      const w = c.width, h = c.height, o = new Uint8ClampedArray(n);
      for (let y = 0; y < h; y++) for (let x2 = 0; x2 < w; x2++) {
        const i = y * w + x2;
        if (x2 === 0 || y === 0 || x2 === w - 1 || y === h - 1) { o[i] = g[i]; continue; }
        o[i] = 5 * g[i] - g[i - 1] - g[i + 1] - g[i - w] - g[i + w];
      }
      out = o;
    }
    for (let i = 0; i < n; i++) { d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = out[i]; d[i * 4 + 3] = 255; }
    x.putImageData(img, 0, 0);
    return c;
  }
  const clean = (r) => r && r.text ? { text: String(r.text).trim(), formaat: r.formaat || guessFormat(String(r.text).trim()) } : null;
  // Snelle poging (voor live scannen).
  async function quickDecode(source, w, h) {
    const c = canvasFrom(source, 0, 0, w, h, Math.min(1280, w), false);
    const n = await nativeDetect(c); if (n) return clean(n);
    if (!window.ZXing) return null;
    return clean(zxingDecode(c) || zxingDecode(filter(c, "contrast")));
  }
  // Grondige poging (voor een foto): de verbeteraar.
  async function deepDecode(img, w, h, progress) {
    await loadZXing().catch(() => {});
    const tries = [];
    // hele foto en stroken (een lange bon heeft de code vaak onderaan)
    const regions = [[0, 0, w, h]];
    if (h > w * 1.2) { const s = Math.round(h / 3); for (let i = 0; i < 5; i++) regions.push([0, Math.round((i * h) / 6), w, Math.min(s + Math.round(h / 6), h - Math.round((i * h) / 6))]); }
    if (w > h * 1.2) { const s = Math.round(w / 3); for (let i = 0; i < 5; i++) regions.push([Math.round((i * w) / 6), 0, Math.min(s + Math.round(w / 6), w - Math.round((i * w) / 6)), h]); }
    // Eerst de snelle varianten op alle stukken, daarna de zwaardere bewerkingen.
    for (const mode of ["none", "vsmooth", "contrast", "bw", "sharp"]) for (const r of regions) for (const rot of [false, true]) for (const maxW of [900, 1400]) tries.push([r, rot, mode, maxW]);
    for (let i = 0; i < tries.length; i++) {
      const [[sx, sy, sw, sh], rot, mode, maxW] = tries[i];
      progress && progress(Math.round((i / tries.length) * 100));
      let c = canvasFrom(img, sx, sy, sw, sh, maxW, rot);
      if (mode !== "none") c = filter(c, mode);
      const n = await nativeDetect(c); if (n) return clean(n);
      if (window.ZXing) { const z = zxingDecode(c); if (z) { return clean(z); } }
      if (i % 4 === 3) await new Promise((r2) => setTimeout(r2, 0)); // scherm laten bijwerken
    }
    return null;
  }


  // Streepjescode als PNG (om te delen).
  async function barcodePng(nr, formaat) {
    await loadJsBarcode();
    const c = document.createElement("canvas");
    const opts = { displayValue: true, fontSize: 22, height: 120, width: 3, margin: 16, background: "#ffffff", lineColor: "#000000" };
    try { JsBarcode(c, nr, { ...opts, format: JSB[formaat] || "CODE128" }); } catch (e) { JsBarcode(c, nr, { ...opts, format: "CODE128" }); }
    return new Promise((res) => c.toBlob(res, "image/png"));
  }

  window.BBScan = { loadZXing, loadJsBarcode, drawBarcode, miniBarcode, guessFormat, eanOk, quickDecode, deepDecode, barcodePng };
})();
