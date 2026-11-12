/* BB — statiegeldbonnen en cadeaubonnen.
 * Eén module, twee soorten. Scannen (met verbeteraar uit scan.js), tekst lezen van de foto,
 * bewerken, delen, afvinken, geldigheid bewaken met waarschuwingen en agenda-herinneringen. */
(() => {
  "use strict";
  const BB = window.BB, S = window.BBScan, I = window.I18N, t = I.t;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const show = (el, text, err) => { el.textContent = text || ""; el.classList.toggle("err", !!err); el.hidden = !text; };
  const addMonths = (iso, n) => { const d = new Date(iso + "T12:00:00"); d.setMonth(d.getMonth() + n); return d.toISOString().slice(0, 10); };
  const daysUntil = (iso) => Math.round((new Date(iso + "T12:00:00") - new Date(BB.today() + "T12:00:00")) / 864e5);
  const newId = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
  const amountIn = (n) => (n == null || n === "" ? "" : I.lang === "en" ? Number(n).toFixed(2) : Number(n).toFixed(2).replace(".", ","));

  const IC = (d) => `<svg class="ic" width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
  const ICONS = {
    scan: IC('<path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16"/><path d="M8 8v8M11 8v8M14 8v8M17 8v8"/>'),
    gal: IC('<rect x="3" y="4" width="18" height="16" rx="2.5"/><circle cx="8.5" cy="9.5" r="1.8"/><path d="M21 16l-5.5-5.5L5 20"/>'),
    kb: IC('<rect x="2.5" y="6" width="19" height="12" rx="2"/><path d="M6 10h.01M9 10h.01M12 10h.01M15 10h.01M18 10h.01M7 14h10"/>'),
    save: IC('<path d="M5 3h11l3 3v13a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z"/><path d="M8 3v5h7V3"/><path d="M9 15l2 2 4-4"/>'),
    text: IC('<path d="M4 7V5h16v2M12 5v14M9 19h6"/>'),
    edit: IC('<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>'),
    share: IC('<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="M8.2 10.8l7.6-4.6M8.2 13.2l7.6 4.6"/>'),
    wa: IC('<path d="M21 11.5a8.5 8.5 0 0 1-12.6 7.4L3 20.5l1.6-5.2A8.5 8.5 0 1 1 21 11.5z"/>'),
    mail: IC('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3.5 6.5L12 13l8.5-6.5"/>'),
    cal: IC('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/><path d="M12 13v3l2 1"/>'),
    bell: IC('<path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15z"/><path d="M10 20a2 2 0 0 0 4 0"/>'),
    warn: IC('<path d="M12 3l9.5 17h-19z"/><path d="M12 10v4M12 17h.01"/>'),
  };

  const KINDS = {
    statiegeld: {
      key: "statiegeld", view: "statiegeld", detail: "sgdetail", p: "sg", fotoPrefix: "sg",
      one: "statiegeldbon", many: "statiegeldbonnen", Title: "Statiegeldbon", months: 3, warnDays: 14,
      totalLabel: "Open tegoed", usedLabel: "Gebruikt", usedFilter: "Gebruikt", amountLabel: "Bedrag (€)",
      shopLabel: "Winkel", shopPh: "bijv. Albert Heijn", dateLabel: "Datum bon",
      bonNr: true, pin: false, van: false, instructie: false,
      empty: "Nog geen statiegeldbonnen. Tik op <b>Scannen</b> en houd de streepjescode voor de camera.",
    },
    cadeau: {
      key: "cadeau", view: "cadeau", detail: "cadetail", p: "ca", fotoPrefix: "ca",
      one: "cadeaubon", many: "cadeaubonnen", Title: "Cadeaubon", months: 24, warnDays: 30,
      totalLabel: "Totale waarde", usedLabel: "Opgemaakt", usedFilter: "Opgemaakt", amountLabel: "Waarde (€)",
      shopLabel: "Winkel of uitgever", shopPh: "bijv. VVV, Bol, Intertoys", dateLabel: "Ontvangen op",
      bonNr: false, pin: true, van: true, instructie: true,
      empty: "Nog geen cadeaubonnen. Tik op <b>Scannen</b> of <b>Typen</b> om je eerste cadeaubon toe te voegen.",
    },
  };

  // ---------- tekst van de foto ontleden ----------
  const AMT = /(\d{1,4}[.,]\d{2})(?!\d)/g;
  function toIso(d, m, y) { if (y.length === 2) y = "20" + y; const dd = +d, mm = +m; return dd >= 1 && dd <= 31 && mm >= 1 && mm <= 12 ? `${y}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}` : null; }
  function parseVoucher(text) {
    const lines = text.split(/\n+/).map((l) => l.replace(/\s+/g, " ").trim()).filter((l) => /[\p{L}\p{N}]{2,}/u.test(l));
    const out = { memo: lines.join("\n").slice(0, 2000) };
    const low = text.toLowerCase();
    out.winkel = (BB.WINKELS || []).find((w) => low.includes(w.toLowerCase())) || null;
    const amt = (l) => { const m = l.match(AMT); return m ? BB.parseAmount(m[m.length - 1]) : null; };
    for (const k of [/statiegeld|emballage|leeggoed/i, /tegoed|waarde|saldo|value|balance/i, /te ontvangen|retour|totaal|bedrag|amount|total/i]) {
      const l = lines.find((x) => k.test(x) && amt(x) != null); if (l) { out.bedrag = amt(l); break; }
    }
    if (out.bedrag == null) { const e = text.match(/€\s*(\d{1,4}[.,]\d{2})/); if (e) out.bedrag = BB.parseAmount(e[1]); }
    const bn = text.match(/\b(?:bon\s*(?:nr|nummer|no)?|bonnr|transactie(?:\s*nr)?|trans\.?\s*nr|ticket(?:\s*nr)?|receipt\s*(?:no|#)?)\s*[:#.]?\s*([A-Z0-9][A-Z0-9\-\/]{2,})/i);
    if (bn) out.bonNr = bn[1];
    const gd = text.match(/(?:geldig\s*(?:tot|t\/m|tm|until)|houdbaar\s*tot|vervalt|verloopt|exp(?:iry|ires)?|valid\s*(?:until|thru))\D{0,14}(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4}|\d{2})/i);
    if (gd) out.geldigTot = toIso(gd[1], gd[2], gd[3]);
    for (const m of text.matchAll(/\b(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4}|\d{2})\b/g)) { const iso = toIso(m[1], m[2], m[3]); if (iso && iso !== out.geldigTot) { out.datum = iso; break; } }
    const pin = text.match(/\bpin(?:code)?\s*[:.]?\s*(\d{4,8})\b/i); if (pin) out.pin = pin[1];
    return out;
  }

  // ---------- module per soort ----------
  function makeModule(K) {
    const p = K.p, id = (x) => p + x, el = (x) => $(p + x);
    const store = BB.store(K.key);
    const st = { items: [], filter: "open", photo: null, formaat: "", editing: null, current: null, stream: null, timer: null, busy: false };
    const fotoName = (s) => `${K.fotoPrefix}-${s.datum || "datum"}-${String(s.id).slice(0, 8)}.jpg`;

    // --- schermen opbouwen ---
    $("view-" + K.view).innerHTML = `
      <div class="sg-sum"><div><span class="hint">${t(K.totalLabel)}</span><b class="amount" id="${id("Open")}">${I.eur(0)}</b></div><span class="hint" id="${id("Count")}"></span></div>
      <div class="warnbar" id="${id("Warn")}" hidden></div>
      <div class="pickers">
        <button class="btn primary big-btn" id="${id("Scan")}" type="button">${ICONS.scan}${t("Scannen")}</button>
        <input type="file" id="${id("Gal")}" class="vh" accept="image/*"><label for="${id("Gal")}" class="btn big-btn">${ICONS.gal}${t("Uit galerij")}</label>
        <button class="btn big-btn" id="${id("Manual")}" type="button">${ICONS.kb}${t("Typen")}</button>
      </div>
      <div class="cam" id="${id("CamBox")}" hidden>
        <div class="scanframe"><video id="${id("Video")}" playsinline muted></video><div class="scanline"></div></div>
        <p class="hint">${t("Houd de streepjescode binnen het kader. Scannen gaat vanzelf.")}</p>
        <div class="btns"><button class="btn" id="${id("CamPhoto")}" type="button">${t("Foto maken")}</button><button class="btn" id="${id("CamCancel")}" type="button">${t("Annuleren")}</button></div>
      </div>
      <div id="${id("Msg")}" class="msg" hidden></div>
      <form id="${id("Form")}" class="group" hidden novalidate>
        <h3 id="${id("FormTitle")}"></h3>
        <img id="${id("Preview")}" class="sg-photo" alt="" hidden>
        <div class="btns"><input type="file" id="${id("FormPhoto")}" class="vh" accept="image/*"><label for="${id("FormPhoto")}" class="btn">${ICONS.gal}${t("Foto kiezen")}</label>
          <button class="btn" id="${id("Ocr")}" type="button" hidden>${ICONS.text}${t("Tekst van de foto lezen")}</button></div>
        <div id="${id("OcrMsg")}" class="msg" hidden></div>
        <div class="barcode-box" id="${id("BarcodeNew")}"></div>
        <label>${t("Nummer van de streepjescode")}<input id="${id("-nummer")}" class="amount" autocomplete="off"></label>
        <div class="row">
          <label>${t(K.amountLabel)}<input id="${id("-bedrag")}" class="amount" inputmode="decimal" placeholder="${I.lang === "en" ? "0.00" : "0,00"}"></label>
          ${K.bonNr ? `<label>${t("BonNr.")}<input id="${id("-bonnr")}" class="amount" autocomplete="off"></label>` : ""}
          ${K.pin ? `<label>${t("Pincode")}<input id="${id("-pin")}" class="amount" inputmode="numeric" autocomplete="off"></label>` : ""}
        </div>
        <label>${t(K.shopLabel)}<input id="${id("-winkel")}" list="dl-winkels" placeholder="${t(K.shopPh)}" autocomplete="off"></label>
        ${K.van ? `<label>${t("Gekregen van")}<input id="${id("-van")}" autocomplete="off"></label>` : ""}
        <div class="row">
          <label>${t(K.dateLabel)}<input id="${id("-datum")}" type="date"></label>
          <label>${t("Geldig tot")}<input id="${id("-geldig")}" type="date"></label>
        </div>
        ${K.instructie ? `<label>${t("Instructie")}<textarea id="${id("-instructie")}" rows="3" placeholder="${t("Bijv. alleen in de winkel, online inwisselen via de website, saldo checken op ...")}"></textarea></label>` : ""}
        <label>${t("Memo")}<textarea id="${id("-memo")}" rows="4" placeholder="${t("Extra info. Tekst die van de foto gelezen wordt, komt hier.")}"></textarea></label>
        <div id="${id("FormMsg")}" class="msg" hidden></div>
        <div class="btns"><button class="btn primary big-btn" type="submit">${ICONS.save}<span id="${id("SaveLbl")}"></span></button><button class="btn" id="${id("FormCancel")}" type="button">${t("Annuleren")}</button></div>
      </form>
      <div class="seg" role="group" aria-label="Filter">
        <button type="button" data-f="open" aria-pressed="true">${t("Open")}</button>
        <button type="button" data-f="gebruikt" aria-pressed="false">${t(K.usedFilter)}</button>
        <button type="button" data-f="verlopen" aria-pressed="false">${t("Verlopen")}</button>
        <button type="button" data-f="alle" aria-pressed="false">${t("Alle")}</button>
      </div>
      <ul class="list" id="${id("List")}"></ul>
      <div class="empty" id="${id("Empty")}">${t(K.empty)}</div>
      <div class="btns" id="${id("NotifRow")}" hidden><button class="btn" id="${id("Notif")}" type="button">${ICONS.bell}${t("Meldingen aanzetten")}</button></div>`;

    $("view-" + K.detail).innerHTML = `
      <button class="back" id="${id("Back")}" type="button">← ${t("Terug")}</button>
      <div class="sg-ticket">
        <div class="sg-status" id="${id("dStatus")}"></div>
        <div class="barcode-box big" id="${id("dBarcode")}"></div>
        <div class="sg-amount amount" id="${id("dBedrag")}"></div>
        <div class="hint" id="${id("dInfo")}"></div>
      </div>
      <div class="slip" id="${id("dFields")}"></div>
      <label class="check"><input type="checkbox" id="${id("dUsed")}"><span>${t(K.usedLabel)} <small id="${id("dUsedOn")}"></small></span></label>
      <div class="btns">
        <button class="btn primary" id="${id("dShare")}" type="button">${ICONS.share}${t("Delen")}</button>
        <a class="btn" id="${id("dWa")}" target="_blank" rel="noopener">${ICONS.wa}WhatsApp</a>
        <a class="btn" id="${id("dMail")}">${ICONS.mail}${t("E-mail")}</a>
      </div>
      <div class="btns">
        <button class="btn" id="${id("dEdit")}" type="button">${ICONS.edit}${t("Bewerken")}</button>
        <button class="btn" id="${id("dCal")}" type="button">${ICONS.cal}${t("Herinnering in agenda")}</button>
      </div>
      <img id="${id("dImg")}" class="detail-img" alt="" hidden>
      <div id="${id("dMsg")}" class="msg" hidden></div>
      <div class="btns"><button class="btn danger" id="${id("dDel")}" type="button">${t("Verwijderen")}</button></div>
      <div class="confirm" id="${id("dConfirm")}" hidden>
        <span>${t("Definitief verwijderen?")}</span>
        <div class="btns"><button class="btn danger" id="${id("dYes")}" type="button">${t("Ja, verwijderen")}</button><button class="btn" id="${id("dNo")}" type="button">${t("Annuleren")}</button></div>
      </div>`;

    // --- status ---
    function status(s) {
      if (s.gebruikt) return { key: "gebruikt", label: t(K.usedLabel), cls: "used" };
      if (s.geldigTot && daysUntil(s.geldigTot) < 0) return { key: "verlopen", label: t("Verlopen"), cls: "expired" };
      if (s.geldigTot && daysUntil(s.geldigTot) <= K.warnDays) {
        const d = daysUntil(s.geldigTot);
        return { key: "open", soon: true, label: d === 0 ? t("Laatste dag") : d === 1 ? t("Nog 1 dag") : t("Nog {n} dagen", { n: d }), cls: "soon" };
      }
      return { key: "open", label: t("Open"), cls: "" };
    }
    const openItems = () => st.items.filter((s) => status(s).key === "open");
    const soonItems = () => st.items.filter((s) => status(s).soon);

    // --- formulier ---
    const f = (x) => el("-" + x);
    function fillForm(s) {
      f("nummer").value = s.nummer || ""; f("bedrag").value = amountIn(s.bedrag);
      if (K.bonNr) f("bonnr").value = s.bonNr || ""; if (K.pin) f("pin").value = s.pin || "";
      if (K.van) f("van").value = s.van || ""; if (K.instructie) f("instructie").value = s.instructie || "";
      f("winkel").value = s.winkel || ""; f("datum").value = s.datum || BB.today(); f("geldig").value = s.geldigTot || "";
      f("memo").value = s.memo || "";
    }
    function setPreview(blob, src) {
      const pv = el("Preview"); if (pv.dataset.url) { URL.revokeObjectURL(pv.dataset.url); delete pv.dataset.url; }
      if (blob) { pv.dataset.url = URL.createObjectURL(blob); pv.src = pv.dataset.url; pv.hidden = false; }
      else if (src) { pv.src = src; pv.hidden = false; } else pv.hidden = true;
      el("Ocr").hidden = !(blob || (st.editing && st.editing.foto instanceof Blob));
    }
    function openForm(opts) {
      const { item, nummer, formaat, blob, thumb } = opts;
      st.editing = item || null;
      st.photo = blob ? { blob, thumb } : null;
      el("FormTitle").textContent = item ? t("{x} bewerken", { x: t(K.Title) }) : t("Nieuwe {x}", { x: t(K.one) });
      el("SaveLbl").textContent = item ? t("Wijzigingen bewaren") : t("{x} bewaren", { x: t(K.Title) });
      if (item) fillForm(item);
      else {
        fillForm({ nummer: nummer || "", datum: BB.today(), geldigTot: addMonths(BB.today(), K.months), winkel: recallWinkel() });
        st.formaat = formaat || (nummer ? S.guessFormat(nummer) : "");
        // Veel statiegeldbonnen (EAN-13 die met 2 begint) hebben het bedrag in de code, in centen.
        if (K.key === "statiegeld" && /^2\d{12}$/.test(nummer || "") && S.eanOk(nummer)) { const ct = parseInt(nummer.slice(7, 12), 10); if (ct > 0 && ct < 50000) f("bedrag").value = amountIn(ct / 100); }
      }
      if (item) st.formaat = item.formaat || S.guessFormat(item.nummer || "");
      setPreview(blob || (item && item.foto instanceof Blob ? item.foto : null), item && !(item.foto instanceof Blob) ? item.thumb : null);
      show(el("FormMsg"), ""); show(el("OcrMsg"), "");
      el("Form").hidden = false;
      S.drawBarcode(el("BarcodeNew"), f("nummer").value, st.formaat);
      if (item) BB.go(K.view);
      el("Form").scrollIntoView({ behavior: "smooth", block: "start" });
      if (blob && !item) readText(blob, true);
    }
    const recallWinkel = () => { try { return localStorage.getItem("bb-" + p + "-winkel") || ""; } catch (e) { return ""; } };
    f("nummer").addEventListener("input", () => { const nr = f("nummer").value.replace(/\s+/g, ""); st.formaat = S.guessFormat(nr); S.drawBarcode(el("BarcodeNew"), nr, st.formaat); });
    f("datum").addEventListener("change", () => { if (f("datum").value && !st.editing) f("geldig").value = addMonths(f("datum").value, K.months); });
    el("Manual").addEventListener("click", () => { stopScan(); show(el("Msg"), ""); openForm({}); f("nummer").focus(); });
    el("FormCancel").addEventListener("click", () => { el("Form").hidden = true; st.photo = null; st.editing = null; });
    el("FormPhoto").addEventListener("change", async (e) => {
      const file = e.target.files && e.target.files[0]; e.target.value = ""; if (!file) return;
      try { const img = await BB.loadImage(file); st.photo = { blob: await BB.toJpeg(img, 1600, 0.85), thumb: await BB.toJpeg(img, 220, 0.6, true) }; setPreview(st.photo.blob); el("Ocr").hidden = false; }
      catch (err) { show(el("FormMsg"), t("Deze foto kon niet worden geopend."), true); }
    });

    // Tekst van de foto lezen en lege velden invullen; alle leesbare tekst gaat naar Memo.
    async function readText(blob, auto) {
      const msg = el("OcrMsg"), btn = el("Ocr");
      btn.disabled = true; show(msg, t("Tekst lezen…"));
      try {
        const text = await BB.ocr(blob, (pc) => show(msg, t("Tekst lezen… {n}%", { n: pc })));
        const r = parseVoucher(text), filled = [];
        const setIf = (key, v, label) => { if (v == null || v === "" || !f(key)) return; if (!f(key).value || (key === "memo") || (key === "geldig" && auto) || (key === "datum" && auto)) { f(key).value = v; filled.push(label); } };
        if (r.bedrag != null && !f("bedrag").value) { f("bedrag").value = amountIn(r.bedrag); filled.push(t("bedrag")); }
        if (K.bonNr) setIf("bonnr", r.bonNr, t("BonNr."));
        if (K.pin) setIf("pin", r.pin, t("pincode"));
        setIf("winkel", r.winkel, t("winkel"));
        if (r.datum) setIf("datum", r.datum, t("datum"));
        if (r.geldigTot) setIf("geldig", r.geldigTot, t("geldig tot"));
        if (r.memo) { f("memo").value = (f("memo").value && !auto ? f("memo").value + "\n\n" : "") + r.memo; filled.push(t("memo")); }
        show(msg, filled.length ? t("Ingevuld: {x}. Controleer het even.", { x: filled.join(", ") }) : t("Er was geen tekst te lezen op de foto."));
      } catch (err) { show(msg, t("De tekst kon niet worden gelezen. Controleer je internetverbinding."), true); }
      finally { btn.disabled = false; }
    }
    el("Ocr").addEventListener("click", () => { const b = st.photo ? st.photo.blob : st.editing && st.editing.foto; if (b) readText(b, false); });

    el("Form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const nummer = f("nummer").value.replace(/\s+/g, "");
      const bedrag = BB.parseAmount(f("bedrag").value);
      if (!nummer && !st.photo && !(st.editing && (st.editing.foto || st.editing.thumb))) { show(el("FormMsg"), t("Vul het nummer van de streepjescode in, of scan de bon."), true); return; }
      if (nummer && st.items.some((s) => s.nummer === nummer && (!st.editing || s.id !== st.editing.id))) { show(el("FormMsg"), t("Deze bon staat er al in."), true); return; }
      const base = st.editing ? { ...st.editing } : { id: newId(), gebruikt: false, gebruiktOp: "", wie: BB.user(), aangemaakt: new Date().toISOString() };
      const item = {
        ...base, nummer, formaat: nummer ? (st.formaat || S.guessFormat(nummer)) : "", bedrag: bedrag == null ? null : bedrag,
        winkel: f("winkel").value.trim(), datum: f("datum").value || BB.today(), geldigTot: f("geldig").value || "", memo: f("memo").value.trim(),
        gewijzigd: new Date().toISOString(),
      };
      if (K.bonNr) item.bonNr = f("bonnr").value.trim();
      if (K.pin) item.pin = f("pin").value.trim();
      if (K.van) item.van = f("van").value.trim();
      if (K.instructie) item.instructie = f("instructie").value.trim();
      if (st.photo) { item.foto = st.photo.blob; item.thumb = st.photo.thumb; }
      try {
        await store.put(item);
        try { localStorage.setItem("bb-" + p + "-winkel", item.winkel); } catch (e2) {}
        const wasEdit = !!st.editing;
        el("Form").hidden = true; st.photo = null; st.editing = null;
        await load();
        if (wasEdit) openDetail(item.id); else { setFilter("open"); show(el("Msg"), t("{x} bewaard.", { x: t(K.Title) })); }
      } catch (err) { show(el("FormMsg"), t("Bewaren is mislukt. Misschien is de opslag van je telefoon vol."), true); }
    });

    // --- foto en live scannen ---
    async function fromImage(img, w, h) {
      show(el("Msg"), t("Streepjescode zoeken…"));
      const r = await S.deepDecode(img, w, h, (pc) => show(el("Msg"), t("Streepjescode zoeken… {n}%", { n: pc })));
      const blob = await BB.toJpeg(img, 1600, 0.85), thumb = await BB.toJpeg(img, 220, 0.6, true);
      if (r) { show(el("Msg"), ""); if (navigator.vibrate) navigator.vibrate(80); openForm({ nummer: r.text, formaat: r.formaat, blob, thumb }); }
      else { show(el("Msg"), t("Er is geen streepjescode gevonden. Typ het nummer onder de streepjes over, of probeer een scherpere foto."), true); openForm({ blob, thumb }); }
    }
    el("Gal").addEventListener("change", async (e) => {
      const file = e.target.files && e.target.files[0]; e.target.value = ""; if (!file) return;
      stopScan();
      try { const img = await BB.loadImage(file); await fromImage(img, img.naturalWidth, img.naturalHeight); }
      catch (err) { show(el("Msg"), t("Deze foto kon niet worden geopend."), true); }
    });
    function stopScan() { clearTimeout(st.timer); st.timer = null; if (st.stream) st.stream.getTracks().forEach((x) => x.stop()); st.stream = null; el("CamBox").hidden = true; }
    function frameCanvas() { const v = el("Video"); if (!v.videoWidth) return null; const c = document.createElement("canvas"); c.width = v.videoWidth; c.height = v.videoHeight; c.getContext("2d").drawImage(v, 0, 0); return c; }
    async function scanLoop() {
      if (!st.stream) return;
      const v = el("Video");
      if (v.videoWidth && !st.busy) {
        st.busy = true;
        try {
          const w = v.videoWidth, h = v.videoHeight, ch = Math.round(h * 0.6);
          const c = document.createElement("canvas"); c.width = w; c.height = ch; c.getContext("2d").drawImage(v, 0, (h - ch) / 2, w, ch, 0, 0, w, ch);
          const r = await S.quickDecode(c, w, ch);
          if (r) {
            const full = frameCanvas(); stopScan(); if (navigator.vibrate) navigator.vibrate(80);
            const blob = await new Promise((res) => full.toBlob(res, "image/jpeg", 0.88));
            const tc = document.createElement("canvas"), sc = 220 / Math.max(full.width, full.height); tc.width = full.width * sc; tc.height = full.height * sc; tc.getContext("2d").drawImage(full, 0, 0, tc.width, tc.height);
            show(el("Msg"), ""); st.busy = false; openForm({ nummer: r.text, formaat: r.formaat, blob, thumb: tc.toDataURL("image/jpeg", 0.6) }); return;
          }
        } catch (e) {}
        st.busy = false;
      }
      st.timer = setTimeout(scanLoop, 220);
    }
    el("Scan").addEventListener("click", async () => {
      show(el("Msg"), ""); el("Form").hidden = true;
      if (!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) { el("Gal").click(); return; }
      S.loadZXing().catch(() => {});
      try {
        st.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
        const v = el("Video"); v.srcObject = st.stream; el("CamBox").hidden = false; await v.play();
        try { const tr = st.stream.getVideoTracks()[0]; const cap = tr.getCapabilities ? tr.getCapabilities() : {}; if (cap.focusMode && cap.focusMode.includes("continuous")) await tr.applyConstraints({ advanced: [{ focusMode: "continuous" }] }); } catch (e) {}
        scanLoop();
      } catch (err) {
        stopScan();
        show(el("Msg"), err && err.name === "NotAllowedError" ? t("BB mag de camera niet gebruiken. Sta de camera toe in je browser, of kies Uit galerij.") : t("De camera kon niet worden gestart. Kies Uit galerij of Typen."), true);
      }
    });
    el("CamCancel").addEventListener("click", stopScan);
    el("CamPhoto").addEventListener("click", async () => { const c = frameCanvas(); stopScan(); if (c) await fromImage(c, c.width, c.height); });
    document.addEventListener("bb:view", (e) => { if (e.detail !== K.view) stopScan(); });

    // --- lijst ---
    function setFilter(x) { st.filter = x; $("view-" + K.view).querySelectorAll("[data-f]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.f === x))); render(); }
    $("view-" + K.view).querySelectorAll("[data-f]").forEach((b) => b.addEventListener("click", () => setFilter(b.dataset.f)));
    async function load() {
      try { st.items = (await store.all()).sort((a, b) => (a.geldigTot || "9").localeCompare(b.geldigTot || "9") || (b.aangemaakt || "").localeCompare(a.aangemaakt || "")); } catch (e) { st.items = []; }
      render(); Warnings.update();
    }
    function render() {
      const open = openItems();
      el("Open").textContent = I.eur(open.reduce((x, s) => x + (Number(s.bedrag) || 0), 0));
      el("Count").textContent = open.length === 1 ? t("1 open bon") : t("{n} open bonnen", { n: open.length });
      const soon = soonItems();
      el("Warn").hidden = !soon.length;
      el("Warn").innerHTML = soon.length ? `<button type="button">${ICONS.warn}<span>${esc(soon.length === 1 ? t("1 {x} verloopt binnen {d} dagen.", { x: t(K.one), d: K.warnDays }) : t("{n} {x} verlopen binnen {d} dagen.", { n: soon.length, x: t(K.many), d: K.warnDays }))}</span></button>` : "";
      const b = el("Warn").querySelector("button"); if (b) b.onclick = () => setFilter("open");
      el("NotifRow").hidden = !("Notification" in window) || Notification.permission !== "default" || !st.items.length;
      const list = st.filter === "alle" ? st.items : st.items.filter((s) => status(s).key === st.filter);
      const ul = el("List"); ul.innerHTML = "";
      el("Empty").hidden = st.items.length > 0;
      if (st.items.length && !list.length) { const li = document.createElement("li"); li.className = "hint"; li.textContent = t("Niets in deze lijst."); ul.appendChild(li); }
      list.forEach((s) => {
        const ss = status(s);
        const li = document.createElement("li"), c = document.createElement("button"); c.type = "button"; c.className = "card" + (s.gebruikt ? " is-used" : "");
        const th = document.createElement("div"); th.className = "sgbar"; th.setAttribute("aria-hidden", "true");
        if (s.nummer) S.miniBarcode(th, s.nummer, s.formaat); else if (s.thumb) { const im = document.createElement("img"); im.src = s.thumb; im.alt = ""; im.style.cssText = "width:100%;height:100%;object-fit:cover"; th.appendChild(im); }
        const tx = document.createElement("div"); tx.className = "t";
        const n = document.createElement("b"); n.textContent = s.winkel || t(K.Title);
        const s1 = document.createElement("span"); s1.className = "amount"; s1.textContent = s.nummer || s.bonNr || "–";
        const s2 = document.createElement("span"); const pill = document.createElement("span"); pill.className = "pill " + ss.cls; pill.textContent = ss.label; s2.appendChild(pill);
        if (s.geldigTot && !s.gebruikt) s2.append(" " + t("t/m") + " " + I.date(s.geldigTot));
        tx.append(n, s1, s2);
        const a = document.createElement("div"); a.className = "a amount"; a.textContent = s.bedrag == null ? "–" : I.eur(s.bedrag);
        c.append(th, tx, a); c.addEventListener("click", () => openDetail(s.id)); li.appendChild(c); ul.appendChild(li);
      });
    }
    el("Notif").addEventListener("click", async () => { try { await Notification.requestPermission(); } catch (e) {} render(); Warnings.notify(true); });

    // --- detail ---
    function shareText(s) {
      const L = [`${t(K.Title)}: ${s.winkel || "–"}`];
      if (s.nummer) L.push(`${t("Nummer")}: ${s.nummer}`);
      if (s.bonNr) L.push(`${t("BonNr.")}: ${s.bonNr}`);
      if (s.bedrag != null) L.push(`${t(K.amountLabel.replace(" (€)", ""))}: ${I.eur(s.bedrag)}`);
      if (s.pin) L.push(`${t("Pincode")}: ${s.pin}`);
      if (s.geldigTot) L.push(`${t("Geldig tot")}: ${I.date(s.geldigTot)}`);
      if (s.van) L.push(`${t("Gekregen van")}: ${s.van}`);
      if (s.instructie) L.push(`${t("Instructie")}: ${s.instructie}`);
      if (s.memo) L.push(`${t("Memo")}: ${s.memo}`);
      L.push(`${t("Status")}: ${status(s).label}`);
      return L.join("\n");
    }
    function openDetail(sid) {
      const s = st.items.find((x) => x.id === sid); if (!s) return; st.current = s;
      const ss = status(s);
      el("dStatus").innerHTML = `<span class="pill ${ss.cls}">${esc(ss.label)}</span>`;
      if (s.nummer) S.drawBarcode(el("dBarcode"), s.nummer, s.formaat, true); else el("dBarcode").innerHTML = "";
      el("dBedrag").textContent = s.bedrag == null ? "" : I.eur(s.bedrag);
      el("dInfo").textContent = [s.winkel, s.datum ? t(K.dateLabel).toLowerCase() + " " + I.date(s.datum) : "", s.geldigTot ? t("geldig tot") + " " + I.date(s.geldigTot) : "", s.wie ? t("door {x}", { x: s.wie }) : ""].filter(Boolean).join(" · ");
      const rows = [];
      if (s.bonNr) rows.push([t("BonNr."), s.bonNr]);
      if (s.pin) rows.push([t("Pincode"), s.pin]);
      if (s.van) rows.push([t("Gekregen van"), s.van]);
      if (s.instructie) rows.push([t("Instructie"), s.instructie]);
      if (s.memo) rows.push([t("Memo"), s.memo]);
      el("dFields").hidden = !rows.length;
      el("dFields").innerHTML = rows.map(([k, v]) => `<div class="ln col"><span>${esc(k)}</span><span class="pre">${esc(v)}</span></div>`).join("");
      el("dUsed").checked = !!s.gebruikt; el("dUsedOn").textContent = s.gebruikt && s.gebruiktOp ? t("op {d}", { d: I.date(s.gebruiktOp) }) : "";
      const text = shareText(s);
      el("dWa").href = "https://wa.me/?text=" + encodeURIComponent(text);
      el("dMail").href = "mailto:?subject=" + encodeURIComponent(`${t(K.Title)} ${s.winkel || ""} ${s.nummer || ""}`.trim()) + "&body=" + encodeURIComponent(text);
      el("dCal").hidden = !s.geldigTot || s.gebruikt;
      const img = el("dImg"); if (img.dataset.url) { URL.revokeObjectURL(img.dataset.url); delete img.dataset.url; }
      if (s.foto instanceof Blob) { img.dataset.url = URL.createObjectURL(s.foto); img.src = img.dataset.url; img.hidden = false; } else if (s.thumb) { img.src = s.thumb; img.hidden = false; } else img.hidden = true;
      el("dConfirm").hidden = true; show(el("dMsg"), "");
      BB.go(K.detail);
      if (navigator.wakeLock) navigator.wakeLock.request("screen").catch(() => {});
    }
    async function update(patch) {
      const s = { ...st.current, ...patch, gewijzigd: new Date().toISOString() }; st.current = s;
      try { await store.put(s); await load(); openDetail(s.id); } catch (e) { show(el("dMsg"), t("Opslaan is mislukt."), true); }
    }
    el("dUsed").addEventListener("change", (e) => update({ gebruikt: e.target.checked, gebruiktOp: e.target.checked ? BB.today() : "" }));
    el("dEdit").addEventListener("click", () => openForm({ item: st.current }));
    el("Back").addEventListener("click", () => BB.go(K.view));
    el("dDel").addEventListener("click", () => { el("dConfirm").hidden = false; });
    el("dNo").addEventListener("click", () => { el("dConfirm").hidden = true; });
    el("dYes").addEventListener("click", async () => { try { await store.del(st.current.id); await load(); BB.go(K.view); } catch (e) { show(el("dMsg"), t("Verwijderen is mislukt."), true); } });
    async function shareFiles(files, text, title) {
      if (navigator.canShare && navigator.canShare({ files })) { try { await navigator.share({ files, text, title }); } catch (e) {} return true; }
      return false;
    }
    function download(file) { const u = URL.createObjectURL(file); const a = document.createElement("a"); a.href = u; a.download = file.name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000); }
    el("dShare").addEventListener("click", async () => {
      const s = st.current; if (!s) return;
      const files = [];
      try { if (s.nummer) { const png = await S.barcodePng(s.nummer, s.formaat); files.push(new File([png], `${p}-${s.nummer}.png`, { type: "image/png" })); } } catch (e) {}
      if (s.foto instanceof Blob) files.push(new File([s.foto], fotoName(s), { type: "image/jpeg" }));
      const text = shareText(s);
      if (files.length && await shareFiles(files, text, t(K.Title))) return;
      if (navigator.share) { try { await navigator.share({ text, title: t(K.Title) }); return; } catch (e) { return; } }
      try { await navigator.clipboard.writeText(text); show(el("dMsg"), t("Tekst gekopieerd. Plak hem in je bericht.")); } catch (e) { show(el("dMsg"), t("Delen kan niet in deze browser. Gebruik WhatsApp of E-mail.")); }
    });
    // Agenda-herinnering (.ics) met meldingen vooraf.
    el("dCal").addEventListener("click", async () => {
      const s = st.current; if (!s || !s.geldigTot) return;
      const d = s.geldigTot.replace(/-/g, ""), next = addMonths(s.geldigTot, 0).replace(/-/g, "");
      const end = new Date(s.geldigTot + "T12:00:00"); end.setDate(end.getDate() + 1); const dEnd = end.toISOString().slice(0, 10).replace(/-/g, "");
      const icsEsc = (x) => String(x).replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/[,;]/g, (c) => "\\" + c);
      const summary = t("{x} {w} verloopt", { x: t(K.Title), w: s.winkel || "" }).replace(/\s+/g, " ");
      const desc = shareText(s);
      const alarm = (days) => `BEGIN:VALARM\r\nACTION:DISPLAY\r\nTRIGGER:-P${days}D\r\nDESCRIPTION:${icsEsc(summary)}\r\nEND:VALARM\r\n`;
      const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
      const ics = `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Vipware//BB//NL\r\nCALSCALE:GREGORIAN\r\nBEGIN:VEVENT\r\nUID:${s.id}@bb.vipware\r\nDTSTAMP:${stamp}\r\nDTSTART;VALUE=DATE:${d}\r\nDTEND;VALUE=DATE:${dEnd}\r\nSUMMARY:${icsEsc(summary)}\r\nDESCRIPTION:${icsEsc(desc)}\r\n${alarm(K.warnDays)}${alarm(7)}${alarm(1)}END:VEVENT\r\nEND:VCALENDAR\r\n`;
      void next;
      const file = new File([ics], `${p}-${s.geldigTot}.ics`, { type: "text/calendar" });
      if (await shareFiles([file], summary, summary)) return;
      download(file); show(el("dMsg"), t("Agendabestand opgeslagen. Open het om de herinnering aan je agenda toe te voegen."));
    });

    // --- voor export en import ---
    return {
      K, load, status, openItems, soonItems, fotoName,
      all: () => store.all(),
      meta: (s) => { const { foto, ...rest } = s; return { ...rest, fotoBestand: fotoName(s) }; },
      async merge(list, getFoto) {
        const local = new Map((await store.all()).map((s) => [s.id, s]));
        let n = 0;
        for (const s of list || []) {
          if (!s || !s.id) continue;
          const { fotoBestand, fotoData, ...rest } = s;
          const mine = local.get(s.id);
          if (mine) {
            if ((rest.gewijzigd || "") > (mine.gewijzigd || "")) await store.put({ ...mine, ...rest, foto: mine.foto });
            else if (s.gebruikt && !mine.gebruikt) await store.put({ ...mine, gebruikt: true, gebruiktOp: s.gebruiktOp || "" });
            continue;
          }
          let foto = null; try { foto = await getFoto(s); } catch (e) {}
          await store.put({ ...rest, foto: foto || undefined }); n++;
        }
        await load();
        return n;
      },
    };
  }

  // ---------- waarschuwingen: tellers, balk op het startscherm, melding ----------
  const Warnings = {
    update() {
      if (!window.BBV) return;
      const bar = $("warnBar"), parts = [];
      for (const m of Object.values(window.BBV)) {
        const soon = m.soonItems();
        BB.setBadge(m.K.view, m.openItems().length, soon.length > 0);
        if (soon.length) parts.push({ m, n: soon.length });
      }
      bar.hidden = !parts.length;
      bar.innerHTML = parts.map(({ m, n }) => `<button type="button" data-go="${m.K.view}">${ICONS.warn}<span>${esc(n === 1 ? t("1 {x} verloopt binnen {d} dagen.", { x: t(m.K.one), d: m.K.warnDays }) : t("{n} {x} verlopen binnen {d} dagen.", { n, x: t(m.K.many), d: m.K.warnDays }))}</span></button>`).join("");
      bar.querySelectorAll("[data-go]").forEach((b) => (b.onclick = () => BB.go(b.dataset.go)));
    },
    // Eén melding per dag als er iets binnenkort verloopt (alleen als meldingen zijn toegestaan).
    async notify(force) {
      if (!("Notification" in window) || Notification.permission !== "granted" || !window.BBV) return;
      const key = "bb-notified", today = BB.today();
      try { if (!force && localStorage.getItem(key) === today) return; } catch (e) {}
      const lines = [];
      for (const m of Object.values(window.BBV)) { const n = m.soonItems().length; if (n) lines.push(n === 1 ? t("1 {x} verloopt binnen {d} dagen.", { x: t(m.K.one), d: m.K.warnDays }) : t("{n} {x} verlopen binnen {d} dagen.", { n, x: t(m.K.many), d: m.K.warnDays })); }
      if (!lines.length) return;
      try { localStorage.setItem(key, today); } catch (e) {}
      const opts = { body: lines.join("\n"), icon: "icons/icon-192.png", tag: "bb-verloopt" };
      try { const reg = navigator.serviceWorker && (await navigator.serviceWorker.getRegistration()); if (reg) { reg.showNotification("BB", opts); return; } } catch (e) {}
      try { new Notification("BB", opts); } catch (e) {}
    },
  };

  window.BBV = { statiegeld: makeModule(KINDS.statiegeld), cadeau: makeModule(KINDS.cadeau) };
  window.BBSG = window.BBV.statiegeld; // oude naam, voor sync.js
  Promise.all(Object.values(window.BBV).map((m) => m.load())).then(() => { Warnings.update(); Warnings.notify(false); });
  document.addEventListener("bb:view", (e) => { const m = Object.values(window.BBV).find((x) => x.K.view === e.detail); if (m) m.load(); });
})();
