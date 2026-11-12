/* Bonnenbak — kassabonnen fotograferen, bewaren (IndexedDB op dit apparaat) en delen. */
(() => {
  "use strict";
  const VERSION = "1.2";
  document.getElementById("appTitle").textContent = "BB v" + VERSION;
  const $ = (id) => document.getElementById(id);
  const state = { bonnen: [], lijsten: { gebruikers: [], projecten: [], passen: [] }, photo: null, current: null, urls: [] };

  // ---------- helpers ----------
  const eur = (n) => "€ " + (Number(n) || 0).toLocaleString("nl-NL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const nlDate = (iso) => { if (!iso) return "–"; const [y, m, d] = iso.split("-"); return d && m && y ? `${d}-${m}-${y}` : iso; };
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
  const DB_NAME = "bonnenbak", DB_VERSION = 1;
  let dbp = null;
  function openDb() {
    if (dbp) return dbp;
    dbp = new Promise((res, rej) => {
      const r = indexedDB.open(DB_NAME, DB_VERSION);
      r.onupgradeneeded = () => {
        const db = r.result;
        if (!db.objectStoreNames.contains("bonnen")) db.createObjectStore("bonnen", { keyPath: "id" });
        if (!db.objectStoreNames.contains("instellingen")) db.createObjectStore("instellingen");
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
  }

  // ---------- views ----------
  function go(view) {
    ["nieuw", "bonnen", "lijsten", "detail"].forEach((v) => ($("view-" + v).hidden = v !== view));
    document.querySelectorAll("nav button").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.view === view || (view === "detail" && b.dataset.view === "bonnen"))));
    window.scrollTo(0, 0);
  }
  document.querySelectorAll("nav button").forEach((b) => b.addEventListener("click", () => go(b.dataset.view)));
  $("backBtn").addEventListener("click", () => go("bonnen"));
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
      const { data } = await T.recognize(state.photo.blob, "nld", { logger: (m) => { if (m.status === "recognizing text") btn.textContent = `Bon wordt gelezen… ${Math.round(m.progress * 100)}%`; } });
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

  // ---------- lijsten ----------
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
  function renderLijsten() {
    const L = state.lijsten;
    fillSelect($("f-wie"), L.gebruikers, "Kies wie", "wie");
    fillSelect($("f-project"), L.projecten, "Kies project", "project");
    fillSelect($("f-pas"), L.passen, "Kies pas of rekening", "pas");
    fillFilter($("flt-project"), L.projecten, "Alle projecten");
    fillFilter($("flt-pas"), L.passen, "Alle passen");
    document.querySelectorAll(".group").forEach((g) => {
      const key = g.dataset.list, box = g.querySelector(".chips"); box.innerHTML = "";
      if (!L[key].length) { const s = document.createElement("span"); s.className = "hint"; s.textContent = "Nog leeg."; box.appendChild(s); }
      L[key].forEach((v) => {
        const c = document.createElement("span"); c.className = "chip";
        const t = document.createElement("span"); t.textContent = v;
        const x = document.createElement("button"); x.type = "button"; x.setAttribute("aria-label", v + " verwijderen"); x.textContent = "×";
        x.onclick = () => saveList(key, L[key].filter((i) => i !== v));
        c.append(t, x); box.appendChild(c);
      });
    });
  }
  ["f-wie", "f-project", "f-pas"].forEach((id) => $(id).addEventListener("change", (e) => remember(id.slice(2), e.target.value)));
  async function saveList(key, arr) {
    state.lijsten = { ...state.lijsten, [key]: arr }; renderLijsten();
    try { await putSetting("lijsten", state.lijsten); } catch (e) {}
  }
  document.querySelectorAll(".group").forEach((g) => {
    const key = g.dataset.list, inp = g.querySelector("input"), btn = g.querySelector(".addrow button");
    const add = () => { const v = inp.value.trim(); if (!v) return; if (!state.lijsten[key].includes(v)) saveList(key, [...state.lijsten[key], v].sort((a, b) => a.localeCompare(b, "nl"))); inp.value = ""; };
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
      wie: $("f-wie").value, project: $("f-project").value, pas: $("f-pas").value, reden: $("f-reden").value.trim(),
      aangemaakt: new Date().toISOString(),
    };
    const missing = [];
    if (!state.photo) missing.push("foto"); if (bedrag == null) missing.push("bedrag");
    if (!bon.wie) missing.push("wie"); if (!bon.project) missing.push("project"); if (!bon.pas) missing.push("pas");
    if (missing.length) { show(msg, "Nog nodig: " + missing.join(", ") + ".", true); return; }
    const btn = $("saveBtn"); btn.disabled = true; btn.textContent = "Bewaren…"; show(msg, "");
    try {
      bon.foto = state.photo.blob; bon.thumb = state.photo.thumb;
      await dbPut(bon);
      $("form").reset(); $("f-datum").value = today(); renderLijsten(); resetPhoto();
      await reload();
      show(msg, "Bon bewaard.");
    } catch (err) {
      show(msg, "Bewaren is mislukt. Misschien is de opslag van je telefoon vol.", true);
    } finally { btn.disabled = false; btn.textContent = "Bon bewaren"; }
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
    `Bon: ${b.winkel || "onbekende winkel"}`, `Datum: ${nlDate(b.datum)}`, `Bedrag: ${eur(b.bedrag)}`,
    `Gekocht door: ${b.wie || "–"}`, `Project: ${b.project || "–"}`, `Betaald met: ${b.pas || "–"}`, `Reden: ${b.reden || "–"}`,
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
    $("mailBtn").href = "mailto:?subject=" + encodeURIComponent(`Bon ${b.winkel || ""} ${nlDate(b.datum)} - ${b.project || ""}`) + "&body=" + encodeURIComponent(text);
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
  $("csvBtn").addEventListener("click", async () => {
    const rows = [["Datum", "Winkel", "Bedrag", "Wie", "Project", "Pas of rekening", "Reden"]]
      .concat(filtered().map((b) => [nlDate(b.datum), b.winkel, (Number(b.bedrag) || 0).toFixed(2).replace(".", ","), b.wie, b.project, b.pas, b.reden]));
    const csv = "﻿" + rows.map((r) => r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(";")).join("\r\n");
    const file = new File([csv], `bonnen-${today()}.csv`, { type: "text/csv" });
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
      const l = await getSetting("lijsten");
      if (l) state.lijsten = { gebruikers: l.gebruikers || [], projecten: l.projecten || [], passen: l.passen || [] };
      renderLijsten();
      await reload();
      if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
    } catch (e) {
      renderLijsten(); renderList();
      $("status").textContent = "Opslag niet beschikbaar in deze browser";
    }
  })();

  if ("serviceWorker" in navigator && location.protocol === "https:") {
    window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
  }
})();
