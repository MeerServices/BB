/* Bonnenbak — kassabonnen fotograferen, bewaren (IndexedDB op dit apparaat) en delen. */
(() => {
  "use strict";
  const VERSION = "2.0";
  document.getElementById("appVer").textContent = "v" + VERSION;
  const $ = (id) => document.getElementById(id);
  const state = { bonnen: [], lijsten: { gebruikers: [], per: {} }, user: "", photo: null, current: null, urls: [] };

  // ---------- helpers ----------
  const I = window.I18N, t = I.t;
  const eur = (n) => I.eur(n);
  const nlDate = (iso) => I.date(iso);
  const today = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
  const parseAmount = (s) => {
    if (s == null) return null; s = String(s).replace(/[€\s]/g, ""); if (!s) return null;
    if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
    const n = parseFloat(s); return isFinite(n) ? Math.round(n * 100) / 100 : null;
  };
  const show = (el, text, err) => { el.textContent = text || ""; el.classList.toggle("err", !!err); el.hidden = !text; };
  const remember = (k, v) => { try { localStorage.setItem("bb-" + k, v); } catch (e) {} };
  const recall = (k) => { try { return localStorage.getItem("bb-" + k); } catch (e) { return null; } };
  const slug = (s) => (s || "onbekend").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  // ---------- storage (IndexedDB) ----------
  const DB_NAME = "bonnenbak", DB_VERSION = 3;
  let dbp = null;
  function openDb() {
    if (dbp) return dbp;
    dbp = new Promise((res, rej) => {
      const r = indexedDB.open(DB_NAME, DB_VERSION);
      r.onupgradeneeded = () => {
        const db = r.result;
        if (!db.objectStoreNames.contains("bonnen")) db.createObjectStore("bonnen", { keyPath: "id" });
        if (!db.objectStoreNames.contains("instellingen")) db.createObjectStore("instellingen");
        if (!db.objectStoreNames.contains("statiegeld")) db.createObjectStore("statiegeld", { keyPath: "id" });
        if (!db.objectStoreNames.contains("cadeau")) db.createObjectStore("cadeau", { keyPath: "id" });
      };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    return dbp;
  }
  async function tx(store, mode, fn) {
    const db = await openDb();
    return new Promise((res, rej) => {
      const t = db.transaction(store, mode), s = t.objectStore(store);
      let out; const req = fn(s); if (req) req.onsuccess = () => { out = req.result; };
      t.oncomplete = () => res(out); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error);
    });
  }
  const dbAll = () => tx("bonnen", "readonly", (s) => s.getAll());
  const dbPut = (bon) => tx("bonnen", "readwrite", (s) => s.put(bon));
  const dbDel = (id) => tx("bonnen", "readwrite", (s) => s.delete(id));
  const getSetting = (k) => tx("instellingen", "readonly", (s) => s.get(k));
  const putSetting = (k, v) => tx("instellingen", "readwrite", (s) => s.put(v, k));

  async function reload() {
    const all = await dbAll();
    state.bonnen = all.sort((a, b) => (b.aangemaakt || "").localeCompare(a.aangemaakt || ""));
    renderList();
    setBadge("bonnen", state.bonnen.length);
  }

  // ---------- views ----------
  const VIEWS = ["info", "kies", "nieuw", "bonnen", "statiegeld", "cadeau", "lijsten", "detail", "sgdetail", "cadetail"];
  const PARENT = { detail: "bonnen", nieuw: "bonnen", sgdetail: "statiegeld", cadetail: "cadeau" };
  // Tellers op de menuknoppen. warn = er verloopt binnenkort iets.
  function setBadge(view, n, warn) {
    const b = document.querySelector(`nav button[data-view="${view}"] .badge`); if (!b) return;
    b.textContent = n > 99 ? "99+" : String(n || ""); b.hidden = !n; b.classList.toggle("warn", !!warn);
  }
  function go(view) {
    VIEWS.forEach((v) => { const el = $("view-" + v); if (el) el.hidden = v !== view; });
    document.querySelectorAll("nav button").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.view === (PARENT[view] || view))));
    window.scrollTo(0, 0);
    document.dispatchEvent(new CustomEvent("bb:view", { detail: view }));
  }
  document.querySelectorAll("nav button").forEach((b) => b.addEventListener("click", () => go(b.dataset.view)));
  $("backBtn").addEventListener("click", () => go("bonnen"));
  $("newBtn").addEventListener("click", () => go("nieuw"));
  $("newBack").addEventListener("click", () => go("bonnen"));
  $("f-datum").value = today();

  // ---------- photo ----------
  function loadImage(file) {
    return new Promise((res, rej) => { const url = URL.createObjectURL(file); const img = new Image(); img.onload = () => res(img); img.onerror = rej; img.src = url; });
  }
  function toJpeg(img, max, q, asData) {
    return new Promise((res) => {
      const s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement("canvas"); c.width = Math.round(img.naturalWidth * s); c.height = Math.round(img.naturalHeight * s);
      const ctx = c.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(img, 0, 0, c.width, c.height);
      if (asData) res(c.toDataURL("image/jpeg", q)); else c.toBlob((b) => res(b), "image/jpeg", q);
    });
  }
  function onPhoto(e) { const file = e.target.files && e.target.files[0]; if (file) usePhoto(file); }
  async function usePhoto(file) {
    show($("formMsg"), "");
    try {
      const img = await loadImage(file);
      const blob = await toJpeg(img, 2000, 0.85);
      const thumb = await toJpeg(img, 220, 0.6, true);
      state.photo = { blob, thumb };
      $("photoPreview").src = img.src; $("photoPreview").hidden = false; $("photoEmpty").hidden = true;
      $("ocrRow").hidden = false; show($("ocrMsg"), "");
    } catch (err) {
      show($("formMsg"), "Deze foto kon niet worden geopend. Probeer een JPG- of PNG-foto.", true);
    }
  }
  $("photoCam").addEventListener("change", onPhoto);
  $("photoGal").addEventListener("change", onPhoto);

  // ---------- webcam op de computer ----------
  // Op een telefoon opent de Camera-knop de camera-app. Op een computer met muis
  // doet de browser dat niet, dus daar gebruiken we de webcam in de pagina zelf.
  const isDesktop = window.matchMedia && window.matchMedia("(pointer: fine)").matches && !/Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  let camStream = null;
  function stopCam() { if (camStream) camStream.getTracks().forEach((t) => t.stop()); camStream = null; $("camBox").hidden = true; }
  if (isDesktop && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    document.querySelector('label[for="photoCam"]').addEventListener("click", async (e) => {
      e.preventDefault();
      show($("formMsg"), "");
      try {
        camStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
        const v = $("camVideo"); v.srcObject = camStream; $("camBox").hidden = false; await v.play();
      } catch (err) {
        stopCam();
        const name = err && err.name;
        show($("formMsg"), name === "NotAllowedError" ? "De browser mag de webcam niet gebruiken. Sta de camera toe via het slotje links van het adres, of kies Uit galerij." : name === "NotFoundError" ? "Er is geen webcam gevonden op deze computer. Kies Uit galerij." : "De webcam kon niet worden gestart. Kies Uit galerij.", true);
      }
    });
    $("camSnap").addEventListener("click", () => {
      const v = $("camVideo"); if (!v.videoWidth) return;
      const c = document.createElement("canvas"); c.width = v.videoWidth; c.height = v.videoHeight; c.getContext("2d").drawImage(v, 0, 0);
      c.toBlob((b) => { stopCam(); if (b) usePhoto(new File([b], "webcam.jpg", { type: "image/jpeg" })); }, "image/jpeg", 0.9);
    });
    $("camCancel").addEventListener("click", stopCam);
  }

  // ---------- OCR (Tesseract.js, wordt pas geladen als je erom vraagt) ----------
  const TESS_URL = "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js";
  let tessLoad = null;
  function loadTesseract() {
    if (window.Tesseract) return Promise.resolve(window.Tesseract);
    if (!tessLoad) tessLoad = new Promise((res, rej) => { const s = document.createElement("script"); s.src = TESS_URL; s.onload = () => res(window.Tesseract); s.onerror = () => { tessLoad = null; rej(new Error("load")); }; document.head.appendChild(s); });
    return tessLoad;
  }
  const WINKELS = ["Karwei", "Gamma", "Praxis", "Hornbach", "Bauhaus", "Hubo", "Formido", "Action", "Hema", "IKEA", "Kruidvat", "Albert Heijn", "Jumbo", "Lidl", "Aldi", "Plus", "Makro", "Sligro", "Intratuin", "Welkoop", "Bouwmaat", "Stiho", "Raab Karcher", "Würth", "Toolstation", "Coolblue", "MediaMarkt", "Blokker", "Xenos", "Boels", "Shell", "BP", "Esso", "Tinq", "Tango", "Total"];
  function parseReceipt(text) {
    const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
    const low = text.toLowerCase();
    // winkel
    let winkel = WINKELS.find((w) => low.includes(w.toLowerCase())) || null;
    if (!winkel) { const first = lines.find((l) => /[a-z]{3,}/i.test(l)); if (first) winkel = first.replace(/[^\p{L}\p{N}&' .-]/gu, "").trim().slice(0, 40) || null; }
    // datum
    let datum = null;
    const dm = text.match(/\b(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4}|\d{2})\b/);
    if (dm) {
      let [, d, m, y] = dm; if (y.length === 2) y = "20" + y;
      const dd = +d, mm = +m;
      if (dd >= 1 && dd <= 31 && mm >= 1 && mm <= 12) datum = `${y}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
    }
    // bedrag
    const amt = /(-?\d{1,5}[.,]\d{2})(?!\d)/g;
    let bedrag = null;
    const keys = [/te\s*betalen/i, /totaal/i, /\btotal\b/i, /\bpin\b|betaald|bankpas|maestro|v\s*pay|visa|mastercard/i];
    for (const k of keys) {
      for (let i = 0; i < lines.length && bedrag == null; i++) {
        if (!k.test(lines[i]) || /subtotaal|btw|korting|wisselgeld|retour/i.test(lines[i])) continue;
        const found = (lines[i].match(amt) || []).concat(lines[i + 1] && !(lines[i].match(amt)) ? (lines[i + 1].match(amt) || []) : []);
        if (found.length) bedrag = parseAmount(found[found.length - 1]);
      }
      if (bedrag != null) break;
    }
    if (bedrag == null) { const all = (text.match(amt) || []).map(parseAmount).filter((n) => n != null && n > 0 && n < 100000); if (all.length) bedrag = Math.max(...all); }
    return { winkel, datum, bedrag };
  }
  $("ocrBtn").addEventListener("click", async () => {
    if (!state.photo) return;
    const btn = $("ocrBtn"); btn.disabled = true; show($("ocrMsg"), "");
    btn.textContent = "Leesprogramma laden…";
    try {
      const T = await loadTesseract();
      btn.textContent = "Bon wordt gelezen…";
      const { data } = await T.recognize(state.photo.blob, "nld+eng", { logger: (m) => { if (m.status === "recognizing text") btn.textContent = `Bon wordt gelezen… ${Math.round(m.progress * 100)}%`; } });
      const r = parseReceipt(data.text || "");
      const filled = [];
      if (r.winkel) { $("f-winkel").value = r.winkel; filled.push("winkel"); }
      if (r.datum) { $("f-datum").value = r.datum; filled.push("datum"); }
      if (r.bedrag != null) { $("f-bedrag").value = r.bedrag.toFixed(2).replace(".", ","); filled.push("bedrag"); }
      show($("ocrMsg"), filled.length ? `Ingevuld: ${filled.join(", ")}. Controleer het even, want lezen gaat niet altijd goed.` : "Er was niets leesbaars op de foto te vinden. Vul de gegevens zelf in.");
    } catch (err) {
      show($("ocrMsg"), "De bon kon niet worden gelezen. Controleer je internetverbinding of vul de gegevens zelf in.", true);
    } finally { btn.disabled = false; btn.textContent = "Bon automatisch lezen"; }
  });

  async function ocr(blob, onProgress) {
    const T = await loadTesseract();
    const { data } = await T.recognize(blob, "nld+eng", { logger: (m) => { if (m.status === "recognizing text" && onProgress) onProgress(Math.round(m.progress * 100)); } });
    return data.text || "";
  }

  // ---------- gebruikers en lijsten ----------
  // lijsten = { gebruikers: [naam], per: { naam: { projecten: [], passen: [] } } }
  const sortNl = (a) => [...new Set(a)].sort((x, y) => x.localeCompare(y, "nl"));
  function normalize(l) {
    l = l || {};
    const gebruikers = sortNl(l.gebruikers || []);
    const per = {};
    if (l.per) for (const [k, v] of Object.entries(l.per)) { per[k] = { projecten: sortNl(v.projecten || []), passen: sortNl(v.passen || []) }; if (v.foto) per[k].foto = v.foto; }
    // Oude opzet (één lijst voor iedereen): geef elke gebruiker die lijsten.
    if (!l.per && (l.projecten || l.passen)) gebruikers.forEach((g) => { per[g] = { projecten: sortNl(l.projecten || []), passen: sortNl(l.passen || []) }; });
    gebruikers.forEach((g) => { if (!per[g]) per[g] = { projecten: [], passen: [] }; });
    return { gebruikers, per };
  }
  const mine = () => state.lijsten.per[state.user] || { projecten: [], passen: [] };
  const allOf = (k) => sortNl([...Object.values(state.lijsten.per).flatMap((v) => v[k] || []), ...state.bonnen.map((b) => b[k === "projecten" ? "project" : "pas"]).filter(Boolean)]);
  function fillSelect(sel, items, placeholder, key) {
    const prev = sel.value || recall(key) || "";
    sel.innerHTML = "";
    const o = document.createElement("option"); o.value = ""; o.textContent = items.length ? placeholder : "Leeg, zie Lijsten"; sel.appendChild(o);
    items.forEach((v) => { const op = document.createElement("option"); op.value = v; op.textContent = v; sel.appendChild(op); });
    if (items.includes(prev)) sel.value = prev;
  }
  function fillFilter(sel, items, label) {
    const prev = sel.value; sel.innerHTML = "";
    const o = document.createElement("option"); o.value = ""; o.textContent = label; sel.appendChild(o);
    items.forEach((v) => { const op = document.createElement("option"); op.value = v; op.textContent = v; sel.appendChild(op); });
    if (items.includes(prev)) sel.value = prev;
  }
  function chips(box, items, onRemove) {
    box.innerHTML = "";
    if (!items.length) { const s = document.createElement("span"); s.className = "hint"; s.textContent = "Nog leeg."; box.appendChild(s); }
    items.forEach((v) => {
      const c = document.createElement("span"); c.className = "chip";
      const t = document.createElement("span"); t.textContent = v;
      const x = document.createElement("button"); x.type = "button"; x.setAttribute("aria-label", v + " verwijderen"); x.textContent = "×";
      x.onclick = () => onRemove(v);
      c.append(t, x); box.appendChild(c);
    });
  }
  function renderLijsten() {
    const L = state.lijsten, M = mine();
    $("userName").textContent = state.user || "Kies wie";
    $("userBtn").replaceChild(avatar(state.user, "av-sm"), $("userBtn").firstElementChild);
    $("meFoto").replaceChildren(avatar(state.user, "av-lg"));
    $("meFotoDel").hidden = !M.foto;
    $("fotoGroup").hidden = !state.user;
    $("f-wie").textContent = state.user || "Kies wie";
    fillSelect($("f-project"), M.projecten, "Kies project", "project-" + state.user);
    fillSelect($("f-pas"), M.passen, "Kies pas of rekening", "pas-" + state.user);
    fillFilter($("flt-project"), allOf("projecten"), "Alle projecten");
    fillFilter($("flt-pas"), allOf("passen"), "Alle passen");
    document.querySelectorAll(".who").forEach((el) => (el.textContent = state.user || "…"));
    document.querySelectorAll(".group[data-list]").forEach((g) => {
      const key = g.dataset.list;
      if (key === "gebruikers") chips(g.querySelector(".chips"), L.gebruikers, (v) => removeUser(v));
      else chips(g.querySelector(".chips"), M[key], (v) => saveMine(key, M[key].filter((i) => i !== v)));
      g.querySelector(".addrow").hidden = key !== "gebruikers" && !state.user;
    });
    // gebruikerskeuze
    const wl = $("whoList"); wl.innerHTML = "";
    L.gebruikers.forEach((g) => {
      const b = document.createElement("button"); b.type = "button"; b.className = "btn";
      b.append(avatar(g, "av-md"), document.createTextNode(g)); if (g === state.user) b.setAttribute("aria-current", "true");
      b.onclick = () => pickUser(g); wl.appendChild(b);
    });
  }
  // Pasfoto: rond plaatje met de foto, of de beginletters als er nog geen foto is.
  function avatar(name, cls) {
    const f = name && state.lijsten.per[name] && state.lijsten.per[name].foto;
    if (f) { const i = document.createElement("img"); i.className = "av " + cls; i.src = f; i.alt = ""; return i; }
    const d = document.createElement("span"); d.className = "av av-init " + cls; d.setAttribute("aria-hidden", "true");
    d.textContent = name ? name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase() : "?";
    return d;
  }
  async function onPasfoto(e) {
    const file = e.target.files && e.target.files[0]; e.target.value = ""; if (!file || !state.user) return;
    try {
      const img = await loadImage(file);
      const side = Math.min(img.naturalWidth, img.naturalHeight), c = document.createElement("canvas"); c.width = c.height = 240;
      c.getContext("2d").drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, 240, 240);
      await saveMine("foto", c.toDataURL("image/jpeg", 0.8));
    } catch (err) {}
  }
  $("meCam").addEventListener("change", onPasfoto);
  $("meGal").addEventListener("change", onPasfoto);
  $("meFotoDel").addEventListener("click", () => { const per = { ...state.lijsten.per, [state.user]: { ...mine() } }; delete per[state.user].foto; saveLijsten({ ...state.lijsten, per }); });
  ["f-project", "f-pas"].forEach((id) => $(id).addEventListener("change", (e) => remember(id.slice(2) + "-" + state.user, e.target.value)));
  async function saveLijsten(next) {
    state.lijsten = normalize(next); renderLijsten();
    try { await putSetting("lijsten", state.lijsten); } catch (e) {}
  }
  function saveMine(key, arr) {
    if (!state.user) return;
    const per = { ...state.lijsten.per, [state.user]: { ...mine(), [key]: arr } };
    return saveLijsten({ ...state.lijsten, per });
  }
  async function addUser(name) {
    name = name.trim(); if (!name) return;
    if (!state.lijsten.gebruikers.includes(name)) await saveLijsten({ ...state.lijsten, gebruikers: [...state.lijsten.gebruikers, name] });
  }
  async function removeUser(name) {
    const per = { ...state.lijsten.per }; delete per[name];
    await saveLijsten({ gebruikers: state.lijsten.gebruikers.filter((g) => g !== name), per });
    if (state.user === name) { state.user = ""; await setUser(""); go("kies"); }
  }
  async function setUser(name) {
    state.user = name; remember("gebruiker", name);
    try { await putSetting("gebruiker", name); } catch (e) {}
    renderLijsten();
  }
  async function pickUser(name) { await setUser(name); go("bonnen"); }
  $("userBtn").addEventListener("click", () => go("kies"));
  $("f-wie").addEventListener("click", () => go("kies"));
  $("whoAdd").addEventListener("click", async () => { const v = $("whoNew").value.trim(); if (!v) return; $("whoNew").value = ""; await addUser(v); await pickUser(v); });
  $("whoNew").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); $("whoAdd").click(); } });
  document.querySelectorAll(".group[data-list]").forEach((g) => {
    const key = g.dataset.list, inp = g.querySelector("input"), btn = g.querySelector(".addrow button");
    const add = () => {
      const v = inp.value.trim(); if (!v) return; inp.value = "";
      if (key === "gebruikers") addUser(v);
      else if (!mine()[key].includes(v)) saveMine(key, [...mine()[key], v]);
    };
    btn.addEventListener("click", add);
    inp.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); add(); } });
  });

  // ---------- bewaren ----------
  function resetPhoto() {
    state.photo = null; $("photoCam").value = ""; $("photoGal").value = "";
    $("photoPreview").hidden = true; $("photoEmpty").hidden = false; $("ocrRow").hidden = true; show($("ocrMsg"), "");
  }
  $("form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = $("formMsg");
    const bedrag = parseAmount($("f-bedrag").value);
    const bon = {
      id: (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2)),
      winkel: $("f-winkel").value.trim(), datum: $("f-datum").value || today(), bedrag,
      wie: state.user, project: $("f-project").value, pas: $("f-pas").value, reden: $("f-reden").value.trim(),
      aangemaakt: new Date().toISOString(),
    };
    const missing = [];
    if (!state.photo) missing.push("foto"); if (bedrag == null) missing.push("bedrag");
    if (!bon.wie) missing.push("wie"); if (!bon.project) missing.push("project"); if (!bon.pas) missing.push("pas");
    if (missing.length) { show(msg, "Nog nodig: " + missing.join(", ") + ".", true); return; }
    const btn = $("saveBtn"), lbl = btn.querySelector("span"); btn.disabled = true; lbl.textContent = "Bewaren…"; show(msg, "");
    try {
      bon.foto = state.photo.blob; bon.thumb = state.photo.thumb;
      await dbPut(bon);
      $("form").reset(); $("f-datum").value = today(); renderLijsten(); resetPhoto();
      await reload();
      show(msg, "Bon bewaard.");
    } catch (err) {
      show(msg, "Bewaren is mislukt. Misschien is de opslag van je telefoon vol.", true);
    } finally { btn.disabled = false; lbl.textContent = "Bon bewaren"; }
  });

  // ---------- lijst ----------
  const filtered = () => { const p = $("flt-project").value, k = $("flt-pas").value; return state.bonnen.filter((b) => (!p || b.project === p) && (!k || b.pas === k)); };
  function renderList() {
    const items = filtered(), ul = $("list"); ul.innerHTML = "";
    $("listEmpty").hidden = state.bonnen.length > 0;
    $("csvBtn").hidden = state.bonnen.length === 0;
    $("cnt").textContent = items.length === 1 ? "1 bon" : items.length + " bonnen";
    $("sum").textContent = eur(items.reduce((s, b) => s + (Number(b.bedrag) || 0), 0));
    items.forEach((b) => {
      const li = document.createElement("li"), c = document.createElement("button"); c.type = "button"; c.className = "card";
      const th = document.createElement("img"); th.className = "th"; th.alt = ""; if (b.thumb) th.src = b.thumb;
      const t = document.createElement("div"); t.className = "t";
      const n = document.createElement("b"); n.textContent = b.winkel || "Onbekende winkel";
      const s1 = document.createElement("span"); s1.textContent = `${nlDate(b.datum)} · ${b.project || "–"}`;
      const s2 = document.createElement("span"); s2.textContent = `${b.wie || "–"} · ${b.pas || "–"}`;
      t.append(n, s1, s2);
      const a = document.createElement("div"); a.className = "a amount"; a.textContent = eur(b.bedrag);
      c.append(th, t, a); c.addEventListener("click", () => openDetail(b.id)); li.appendChild(c); ul.appendChild(li);
    });
    const dl = $("dl-winkels"); dl.innerHTML = "";
    [...new Set(state.bonnen.map((b) => b.winkel).filter(Boolean))].forEach((w) => { const o = document.createElement("option"); o.value = w; dl.appendChild(o); });
  }
  $("flt-project").addEventListener("change", renderList);
  $("flt-pas").addEventListener("change", renderList);

  // ---------- detail en delen ----------
  const shareText = (b) => [
    `${t("Bon")}: ${b.winkel || t("onbekende winkel")}`, `${t("Datum")}: ${nlDate(b.datum)}`, `${t("Bedrag")}: ${eur(b.bedrag)}`,
    `${t("Gekocht door")}: ${b.wie || "–"}`, `${t("Project")}: ${b.project || "–"}`, `${t("Betaald met")}: ${b.pas || "–"}`, `${t("Reden")}: ${b.reden || "–"}`,
  ].join("\n");
  const fileName = (b) => `bon-${slug(b.winkel)}-${b.datum || "datum"}.jpg`;
  function openDetail(id) {
    const b = state.bonnen.find((x) => x.id === id); if (!b) return; state.current = b;
    state.urls.forEach((u) => URL.revokeObjectURL(u)); state.urls = [];
    const img = $("d-img");
    if (b.foto instanceof Blob) { const u = URL.createObjectURL(b.foto); state.urls.push(u); img.src = u; } else img.src = b.thumb || "";
    const slip = $("d-slip"); slip.innerHTML = "";
    const line = (k, v, cls) => { const d = document.createElement("div"); d.className = "ln" + (cls ? " " + cls : ""); const x = document.createElement("span"); x.textContent = k; const y = document.createElement("span"); y.textContent = v; d.append(x, y); slip.appendChild(d); };
    const hdr = document.createElement("div"); hdr.className = "tot"; hdr.textContent = (b.winkel || "Onbekende winkel").toUpperCase(); slip.appendChild(hdr);
    line("Datum", nlDate(b.datum)); slip.appendChild(document.createElement("hr"));
    line("Gekocht door", b.wie || "–"); line("Project", b.project || "–"); line("Betaald met", b.pas || "–"); line("Reden", b.reden || "–");
    slip.appendChild(document.createElement("hr")); line("TOTAAL", eur(b.bedrag), "tot");
    const text = shareText(b); $("d-text").textContent = text;
    $("waBtn").href = "https://wa.me/?text=" + encodeURIComponent(text);
    $("mailBtn").href = "mailto:?subject=" + encodeURIComponent(`${t("Bon")} ${b.winkel || ""} ${nlDate(b.datum)} - ${b.project || ""}`) + "&body=" + encodeURIComponent(text);
    const canFiles = !!(navigator.canShare && b.foto instanceof Blob && navigator.canShare({ files: [new File([b.foto], fileName(b), { type: "image/jpeg" })] }));
    $("shareBtn").textContent = canFiles ? "Delen met foto" : "Foto opslaan";
    $("shareHint").hidden = !canFiles;
    $("delConfirm").hidden = true; show($("detailMsg"), "");
    go("detail");
  }
  $("shareBtn").addEventListener("click", async () => {
    const b = state.current; if (!b) return;
    const file = b.foto instanceof Blob ? new File([b.foto], fileName(b), { type: "image/jpeg" }) : null;
    const text = shareText(b);
    if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], text, title: `Bon ${b.winkel || ""}` }); }
      catch (err) { if (err && err.name !== "AbortError") show($("detailMsg"), "Delen is niet gelukt. Probeer WhatsApp of e-mail met alleen tekst.", true); }
      return;
    }
    // Geen delen met bestanden (bijv. op de computer): foto downloaden.
    if (file) {
      const u = URL.createObjectURL(file); const a = document.createElement("a"); a.href = u; a.download = file.name; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(u), 4000);
      show($("detailMsg"), "Foto opgeslagen. Voeg hem toe aan je WhatsApp- of e-mailbericht.");
    }
  });
  $("delBtn").addEventListener("click", () => { $("delConfirm").hidden = false; });
  $("delNo").addEventListener("click", () => { $("delConfirm").hidden = true; });
  $("delYes").addEventListener("click", async () => {
    const b = state.current; if (!b) return;
    try { await dbDel(b.id); await reload(); go("bonnen"); }
    catch (err) { show($("detailMsg"), "Verwijderen is mislukt. Probeer het opnieuw.", true); }
  });

  // ---------- CSV-overzicht ----------
  function csvText(list) {
    const rows = [["Datum", "Winkel", "Bedrag", "Wie", "Project", "Pas of rekening", "Reden", "Foto"]]
      .concat(list.map((b) => [nlDate(b.datum), b.winkel, (Number(b.bedrag) || 0).toFixed(2).replace(".", ","), b.wie, b.project, b.pas, b.reden, fotoName(b)]));
    return "﻿" + rows.map((r) => r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(";")).join("\r\n");
  }
  // Vaste bestandsnaam per bon, gebruikt in de export naar Dropbox en Drive.
  const fotoName = (b) => `${b.datum || "datum"}-${slug(b.winkel)}-${String(b.id).slice(0, 8)}.jpg`;
  $("csvBtn").addEventListener("click", async () => {
    const file = new File([csvText(filtered())], `bonnen-${today()}.csv`, { type: "text/csv" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: "Overzicht bonnen" }); } catch (e) {}
    } else {
      const u = URL.createObjectURL(file); const a = document.createElement("a"); a.href = u; a.download = file.name; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(u), 4000);
    }
  });

  // ---------- start ----------
  (async () => {
    try {
      state.lijsten = normalize(await getSetting("lijsten"));
      const u = (await getSetting("gebruiker")) || recall("gebruiker") || "";
      state.user = state.lijsten.gebruikers.includes(u) ? u : "";
      await reload();
      renderLijsten();
      if (!state.user) go("kies");
      if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
    } catch (e) {
      renderLijsten(); renderList();
      go("kies");
    }
  })();

  // ---------- info en bedankje ----------
  const FB_START = t("Bedankt voor BB!") + "\n\n" + t("Het volgende zou interessant zijn om erbij te hebben of te verbeteren:") + "\n";
  let lastView = "nieuw";
  function updateFb() {
    const to = (window.BB_CONFIG && window.BB_CONFIG.feedbackEmail) || "";
    const body = $("fbText").value + `\n\n(BB v${VERSION}${state.user ? ", " + state.user : ""})`;
    $("fbMail").href = "mailto:" + encodeURIComponent(to) + "?subject=" + encodeURIComponent(`${t("Bedankje voor BB")} v${VERSION}`) + "&body=" + encodeURIComponent(body);
    $("fbWa").href = "https://wa.me/" + ((window.BB_CONFIG && window.BB_CONFIG.feedbackWhatsapp) || "") + "?text=" + encodeURIComponent(body);
  }
  $("appTitle").addEventListener("click", () => {
    const cur = VIEWS.filter((v) => v !== "info").find((v) => !$("view-" + v).hidden); if (cur) lastView = cur;
    $("infoVer").textContent = "v" + VERSION;
    if (!$("fbText").value.trim()) $("fbText").value = FB_START;
    updateFb(); go("info");
  });
  $("fbText").addEventListener("input", updateFb);
  $("infoBack").addEventListener("click", () => go(PARENT[lastView] || lastView));

  // Koppelpunt voor sync.js (export en import).
  window.BB = {
    all: async () => { await reload(); return state.bonnen.slice(); },
    put: dbPut,
    lijsten: () => JSON.parse(JSON.stringify(state.lijsten)),
    setLijsten: (l) => saveLijsten(l),
    normalize,
    getSetting, putSetting, reload, csvText, fotoName, today, go, setBadge, ocr, WINKELS, loadImage, toJpeg, slug, eur, nlDate, parseAmount,
    user: () => state.user,
    store: (name) => ({
      all: () => tx(name, "readonly", (s) => s.getAll()),
      put: (v) => tx(name, "readwrite", (s) => s.put(v)),
      del: (id) => tx(name, "readwrite", (s) => s.delete(id)),
    }),
  };
  document.dispatchEvent(new Event("bb:ready"));

  // ---------- uitklapmenu's ----------
  // Een blok met class "fold" klapt in en uit door op de kop te tikken. De stand wordt onthouden.
  document.querySelectorAll(".group.fold").forEach((g) => {
    const h = g.querySelector(":scope > h3"), key = "fold-" + g.dataset.fold;
    const b = document.createElement("button"); b.type = "button"; b.className = "fold-btn";
    const lab = document.createElement("span"); lab.className = "fold-label";
    while (h.firstChild) lab.appendChild(h.firstChild);
    b.appendChild(lab);
    b.insertAdjacentHTML("beforeend", '<svg class="ic chev" width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>');
    h.appendChild(b);
    const set = (open) => { g.classList.toggle("closed", !open); b.setAttribute("aria-expanded", String(open)); };
    set(recall(key) === "1");
    b.addEventListener("click", () => { const open = g.classList.contains("closed"); set(open); remember(key, open ? "1" : "0"); });
  });

  if ("serviceWorker" in navigator && location.protocol === "https:") {
    window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
  }
})();
