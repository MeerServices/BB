/* BB — statiegeldbonnen (emballage): scannen, nummer eruit halen, streepjescode tonen, afvinken. */
(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const BB = window.BB;
  const store = BB.store("statiegeld");
  const state = { items: [], filter: "open", photo: null, formaat: "", current: null, stream: null, timer: null, busy: false };
  const show = (el, text, err) => { el.textContent = text || ""; el.classList.toggle("err", !!err); el.hidden = !text; };
  const addMonths = (iso, n) => { const d = new Date(iso + "T12:00:00"); d.setMonth(d.getMonth() + n); return d.toISOString().slice(0, 10); };
  const daysUntil = (iso) => Math.round((new Date(iso + "T12:00:00") - new Date(BB.today() + "T12:00:00")) / 864e5);
  const fotoName = (s) => `sg-${s.datum || "datum"}-${String(s.id).slice(0, 8)}.jpg`;

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

  // ---------- nieuwe bon ----------
  function openForm(nummer, formaat, blob, thumb) {
    state.formaat = formaat || (nummer ? guessFormat(nummer) : "");
    state.photo = blob ? { blob, thumb } : null;
    $("sgForm").hidden = false;
    $("sg-nummer").value = nummer || "";
    $("sg-datum").value = BB.today();
    $("sg-geldig").value = addMonths(BB.today(), 3);
    $("sg-bedrag").value = ""; $("sg-winkel").value = recallWinkel();
    // Veel winkelbonnen (EAN-13 die met 2 begint) hebben het bedrag in de code, in centen.
    if (/^2\d{12}$/.test(nummer || "") && eanOk(nummer)) { const ct = parseInt(nummer.slice(7, 12), 10); if (ct > 0 && ct < 50000) { $("sg-bedrag").value = (ct / 100).toFixed(2).replace(".", ","); show($("sgFormMsg"), "Het bedrag is uit de streepjescode gehaald. Controleer het even."); } else show($("sgFormMsg"), ""); }
    else show($("sgFormMsg"), "");
    const pv = $("sgPreview"); if (blob) { if (pv.dataset.url) URL.revokeObjectURL(pv.dataset.url); pv.dataset.url = URL.createObjectURL(blob); pv.src = pv.dataset.url; pv.hidden = false; } else pv.hidden = true;
    drawBarcode($("sgBarcodeNew"), nummer, state.formaat);
    $("sgForm").scrollIntoView({ behavior: "smooth", block: "start" });
    (nummer ? $("sg-bedrag") : $("sg-nummer")).focus({ preventScroll: true });
  }
  const recallWinkel = () => { try { return localStorage.getItem("bb-sg-winkel") || ""; } catch (e) { return ""; } };
  $("sg-nummer").addEventListener("input", () => {
    const nr = $("sg-nummer").value.replace(/\s+/g, "");
    state.formaat = guessFormat(nr);
    drawBarcode($("sgBarcodeNew"), nr, state.formaat);
  });
  $("sg-datum").addEventListener("change", () => { if ($("sg-datum").value) $("sg-geldig").value = addMonths($("sg-datum").value, 3); });
  $("sgManual").addEventListener("click", () => { stopScan(); show($("sgMsg"), ""); openForm("", "", null, null); });
  $("sgFormCancel").addEventListener("click", () => { $("sgForm").hidden = true; state.photo = null; });
  $("sgForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const nummer = $("sg-nummer").value.replace(/\s+/g, "");
    const bedrag = BB.parseAmount($("sg-bedrag").value);
    if (!nummer) { show($("sgFormMsg"), "Vul het nummer van de streepjescode in, of scan de bon.", true); return; }
    if (state.items.some((s) => s.nummer === nummer)) { show($("sgFormMsg"), "Deze statiegeldbon staat er al in.", true); return; }
    const item = {
      id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2),
      nummer, formaat: state.formaat || guessFormat(nummer), bedrag: bedrag == null ? null : bedrag,
      winkel: $("sg-winkel").value.trim(), datum: $("sg-datum").value || BB.today(), geldigTot: $("sg-geldig").value || "",
      gebruikt: false, gebruiktOp: "", wie: BB.user(), aangemaakt: new Date().toISOString(),
    };
    if (state.photo) { item.foto = state.photo.blob; item.thumb = state.photo.thumb; }
    try {
      await store.put(item);
      try { localStorage.setItem("bb-sg-winkel", item.winkel); } catch (e2) {}
      $("sgForm").hidden = true; state.photo = null;
      setFilter("open"); await load();
      show($("sgMsg"), "Statiegeldbon bewaard.");
    } catch (err) { show($("sgFormMsg"), "Bewaren is mislukt. Misschien is de opslag van je telefoon vol.", true); }
  });

  async function fromImage(img, w, h) {
    show($("sgMsg"), "Streepjescode zoeken…");
    const r = await deepDecode(img, w, h, (p) => show($("sgMsg"), `Streepjescode zoeken… ${p}%`));
    const blob = await BB.toJpeg(img, 1600, 0.85), thumb = await BB.toJpeg(img, 220, 0.6, true);
    if (r) { show($("sgMsg"), ""); openForm(r.text, r.formaat, blob, thumb); if (navigator.vibrate) navigator.vibrate(80); }
    else { show($("sgMsg"), "Er is geen streepjescode gevonden. Probeer een scherpere foto met de code recht en goed belicht, of typ het nummer onder de streepjes over.", true); openForm("", "", blob, thumb); }
  }
  $("sgGal").addEventListener("change", async (e) => {
    const f = e.target.files && e.target.files[0]; e.target.value = ""; if (!f) return;
    stopScan();
    try { const img = await BB.loadImage(f); await fromImage(img, img.naturalWidth, img.naturalHeight); }
    catch (err) { show($("sgMsg"), "Deze foto kon niet worden geopend.", true); }
  });

  // ---------- live scannen ----------
  function stopScan() {
    clearTimeout(state.timer); state.timer = null;
    if (state.stream) state.stream.getTracks().forEach((t) => t.stop());
    state.stream = null; $("sgCamBox").hidden = true;
  }
  function frameCanvas() {
    const v = $("sgVideo"); if (!v.videoWidth) return null;
    const c = document.createElement("canvas"); c.width = v.videoWidth; c.height = v.videoHeight; c.getContext("2d").drawImage(v, 0, 0); return c;
  }
  async function scanLoop() {
    if (!state.stream) return;
    const v = $("sgVideo");
    if (v.videoWidth && !state.busy) {
      state.busy = true;
      try {
        // middenstuk van het beeld, daar zit het kader
        const w = v.videoWidth, h = v.videoHeight, ch = Math.round(h * 0.6);
        const c = document.createElement("canvas"); c.width = w; c.height = ch; c.getContext("2d").drawImage(v, 0, (h - ch) / 2, w, ch, 0, 0, w, ch);
        const r = await quickDecode(c, w, ch);
        if (r) {
          const full = frameCanvas(); stopScan();
          if (navigator.vibrate) navigator.vibrate(80);
          const blob = await new Promise((res) => full.toBlob(res, "image/jpeg", 0.85));
          const t = document.createElement("canvas"), s = 220 / Math.max(full.width, full.height); t.width = full.width * s; t.height = full.height * s; t.getContext("2d").drawImage(full, 0, 0, t.width, t.height);
          show($("sgMsg"), ""); openForm(r.text, r.formaat, blob, t.toDataURL("image/jpeg", 0.6));
          state.busy = false; return;
        }
      } catch (e) {}
      state.busy = false;
    }
    state.timer = setTimeout(scanLoop, 220);
  }
  $("sgScan").addEventListener("click", async () => {
    show($("sgMsg"), ""); $("sgForm").hidden = true;
    if (!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) { $("sgGal").click(); return; }
    loadZXing().catch(() => {});
    try {
      state.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
      const v = $("sgVideo"); v.srcObject = state.stream; $("sgCamBox").hidden = false; await v.play();
      // scherpstellen dichtbij als de camera dat kan
      try { const tr = state.stream.getVideoTracks()[0]; const cap = tr.getCapabilities ? tr.getCapabilities() : {}; if (cap.focusMode && cap.focusMode.includes("continuous")) await tr.applyConstraints({ advanced: [{ focusMode: "continuous" }] }); } catch (e) {}
      scanLoop();
    } catch (err) {
      stopScan();
      show($("sgMsg"), err && err.name === "NotAllowedError" ? "BB mag de camera niet gebruiken. Sta de camera toe in je browser, of kies Uit galerij." : "De camera kon niet worden gestart. Kies Uit galerij of Typen.", true);
    }
  });
  $("sgCamCancel").addEventListener("click", stopScan);
  $("sgCamPhoto").addEventListener("click", async () => { const c = frameCanvas(); stopScan(); if (c) await fromImage(c, c.width, c.height); });
  document.addEventListener("bb:view", (e) => { if (e.detail !== "statiegeld") stopScan(); if (e.detail === "statiegeld") load(); });

  // ---------- lijst ----------
  function status(s) {
    if (s.gebruikt) return { key: "gebruikt", label: "Gebruikt", cls: "used" };
    if (s.geldigTot && daysUntil(s.geldigTot) < 0) return { key: "verlopen", label: "Verlopen", cls: "expired" };
    if (s.geldigTot && daysUntil(s.geldigTot) <= 14) return { key: "open", label: daysUntil(s.geldigTot) === 0 ? "Laatste dag" : `Nog ${daysUntil(s.geldigTot)} ${daysUntil(s.geldigTot) === 1 ? "dag" : "dagen"}`, cls: "soon" };
    return { key: "open", label: "Open", cls: "" };
  }
  function setFilter(f) { state.filter = f; document.querySelectorAll("[data-sgf]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.sgf === f))); render(); }
  document.querySelectorAll("[data-sgf]").forEach((b) => b.addEventListener("click", () => setFilter(b.dataset.sgf)));
  async function load() {
    try { state.items = (await store.all()).sort((a, b) => (a.geldigTot || "9").localeCompare(b.geldigTot || "9") || (b.aangemaakt || "").localeCompare(a.aangemaakt || "")); } catch (e) { state.items = []; }
    render();
  }
  function render() {
    const open = state.items.filter((s) => status(s).key === "open");
    $("sgOpen").textContent = BB.eur(open.reduce((t, s) => t + (Number(s.bedrag) || 0), 0));
    $("sgCount").textContent = open.length === 1 ? "1 open bon" : `${open.length} open bonnen`;
    const list = state.filter === "alle" ? state.items : state.items.filter((s) => status(s).key === state.filter);
    const ul = $("sgList"); ul.innerHTML = "";
    $("sgEmpty").hidden = state.items.length > 0;
    if (state.items.length && !list.length) { const li = document.createElement("li"); li.className = "hint"; li.textContent = state.filter === "open" ? "Geen open statiegeldbonnen." : state.filter === "gebruikt" ? "Nog niets afgevinkt als gebruikt." : "Geen verlopen bonnen."; ul.appendChild(li); }
    list.forEach((s) => {
      const st = status(s);
      const li = document.createElement("li"), c = document.createElement("button"); c.type = "button"; c.className = "card" + (s.gebruikt ? " is-used" : "");
      const th = document.createElement("div"); th.className = "sgbar"; th.setAttribute("aria-hidden", "true"); miniBarcode(th, s.nummer, s.formaat);
      const t = document.createElement("div"); t.className = "t";
      const n = document.createElement("b"); n.textContent = s.winkel || "Statiegeldbon";
      const s1 = document.createElement("span"); s1.className = "amount"; s1.textContent = s.nummer;
      const s2 = document.createElement("span"); const pill = document.createElement("span"); pill.className = "pill " + st.cls; pill.textContent = st.label; s2.appendChild(pill);
      if (s.geldigTot && !s.gebruikt) s2.append(" t/m " + BB.nlDate(s.geldigTot));
      t.append(n, s1, s2);
      const a = document.createElement("div"); a.className = "a amount"; a.textContent = s.bedrag == null ? "–" : BB.eur(s.bedrag);
      c.append(th, t, a); c.addEventListener("click", () => openDetail(s.id)); li.appendChild(c); ul.appendChild(li);
    });
  }

  // ---------- detail ----------
  function openDetail(id) {
    const s = state.items.find((x) => x.id === id); if (!s) return; state.current = s;
    const st = status(s);
    $("sgdStatus").innerHTML = ""; const p = document.createElement("span"); p.className = "pill " + st.cls; p.textContent = st.label; $("sgdStatus").appendChild(p);
    drawBarcode($("sgdBarcode"), s.nummer, s.formaat, true);
    $("sgdBedrag").textContent = s.bedrag == null ? "" : BB.eur(s.bedrag);
    $("sgdInfo").textContent = [s.winkel, s.datum ? "bon van " + BB.nlDate(s.datum) : "", s.wie ? "gescand door " + s.wie : ""].filter(Boolean).join(" · ");
    $("sgdUsed").checked = !!s.gebruikt; $("sgdUsedOn").textContent = s.gebruikt && s.gebruiktOp ? "op " + BB.nlDate(s.gebruiktOp) : "";
    $("sgdGeldig").value = s.geldigTot || "";
    const img = $("sgdImg"); if (img.dataset.url) { URL.revokeObjectURL(img.dataset.url); delete img.dataset.url; }
    if (s.foto instanceof Blob) { img.dataset.url = URL.createObjectURL(s.foto); img.src = img.dataset.url; img.hidden = false; } else if (s.thumb) { img.src = s.thumb; img.hidden = false; } else img.hidden = true;
    $("sgdConfirm").hidden = true; show($("sgdMsg"), "");
    BB.go("sgdetail");
    // scherm feller zodat de kassa de code goed kan lezen
    if (navigator.wakeLock) navigator.wakeLock.request("screen").catch(() => {});
  }
  async function update(patch) {
    const s = { ...state.current, ...patch }; state.current = s;
    try { await store.put(s); await load(); openDetail(s.id); } catch (e) { show($("sgdMsg"), "Opslaan is mislukt.", true); }
  }
  $("sgdUsed").addEventListener("change", (e) => update({ gebruikt: e.target.checked, gebruiktOp: e.target.checked ? BB.today() : "" }));
  $("sgdGeldig").addEventListener("change", (e) => update({ geldigTot: e.target.value }));
  $("sgBack").addEventListener("click", () => BB.go("statiegeld"));
  $("sgdDel").addEventListener("click", () => { $("sgdConfirm").hidden = false; });
  $("sgdNo").addEventListener("click", () => { $("sgdConfirm").hidden = true; });
  $("sgdYes").addEventListener("click", async () => { try { await store.del(state.current.id); await load(); BB.go("statiegeld"); } catch (e) { show($("sgdMsg"), "Verwijderen is mislukt.", true); } });

  // ---------- voor export en import ----------
  window.BBSG = {
    fotoName,
    all: async () => (await store.all()),
    meta: (s) => { const { foto, ...rest } = s; return { ...rest, fotoBestand: fotoName(s) }; },
    // Voegt nieuwe statiegeldbonnen toe; bij bestaande neemt hij "gebruikt" over.
    async merge(list, getFoto) {
      const local = new Map((await store.all()).map((s) => [s.id, s]));
      let n = 0;
      for (const s of list || []) {
        if (!s || !s.id) continue;
        const { fotoBestand, fotoData, ...rest } = s;
        const mine = local.get(s.id);
        if (mine) { if (s.gebruikt && !mine.gebruikt) await store.put({ ...mine, gebruikt: true, gebruiktOp: s.gebruiktOp || "" }); continue; }
        let foto = null; try { foto = await getFoto(s); } catch (e) {}
        await store.put({ ...rest, foto: foto || undefined }); n++;
      }
      await load();
      return n;
    },
  };
  load();
})();
