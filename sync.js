/* BB — export en import: back-upbestand, Dropbox en Google Drive.
 *
 * Wat er wordt weggeschreven (in Dropbox in de app-map, in Drive in de map "Bonnenbak"):
 *   backup.json   alle bonnen (zonder grote foto) en de lijsten
 *   bonnen.csv    overzicht voor Excel
 *   fotos/<naam>.jpg   de foto van elke bon
 * Importeren voegt bonnen toe die nog niet op dit apparaat staan (op id) en vult de lijsten aan.
 */
(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const CFG = window.BB_CONFIG || {};
  const msg = (text, err) => { const el = $("syncMsg"); el.textContent = text || ""; el.classList.toggle("err", !!err); el.hidden = !text; };
  const busy = (on) => document.querySelectorAll("#syncBox button, #syncBox label.btn").forEach((b) => { b.disabled = on; b.classList.toggle("is-busy", on); });
  const REDIRECT = location.origin + location.pathname;

  // ---------- gemeenschappelijk ----------
  const blobToB64 = (blob) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1]); r.onerror = rej; r.readAsDataURL(blob); });
  const b64ToBlob = (b64, type) => { const bin = atob(b64); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new Blob([u], { type }); };
  const meta = (b) => { const { foto, ...rest } = b; return { ...rest, fotoBestand: window.BB.fotoName(b) }; };

  async function buildBackup() {
    const bonnen = await window.BB.all();
    const out = { app: "BB", formaat: 1, gemaakt: new Date().toISOString(), lijsten: window.BB.lijsten(), bonnen: bonnen.map(meta) };
    for (const [k, m] of Object.entries(window.BBV || {})) out[k] = (await m.all()).map(m.meta);
    return out;
  }
  // Alle foto's die mee moeten: van bonnen en van statiegeldbonnen.
  async function allPhotos() {
    const out = (await window.BB.all()).filter((b) => b.foto instanceof Blob).map((b) => ({ name: window.BB.fotoName(b), blob: b.foto }));
    for (const m of Object.values(window.BBV || {})) (await m.all()).filter((s) => s.foto instanceof Blob).forEach((s) => out.push({ name: m.fotoName(s), blob: s.foto }));
    return out;
  }
  // Voegt bonnen uit een back-up toe. getFoto(bon) levert de foto als Blob (of null).
  async function mergeBackup(data, getFoto, progress) {
    if (!data || data.app !== "BB" || !Array.isArray(data.bonnen)) throw new Error("geen-backup");
    const localList = await window.BB.all(), local = new Set(localList.map((b) => b.id));
    // Bewerkte bonnen: de nieuwste versie wint (foto blijft die van dit toestel).
    for (const b of data.bonnen) {
      const mine = b && b.id && localList.find((x) => x.id === b.id);
      if (mine && (b.gewijzigd || "") > (mine.gewijzigd || "")) { const { fotoBestand, fotoData, ...rest } = b; await window.BB.put({ ...mine, ...rest, foto: mine.foto, thumb: mine.thumb }); }
    }
    const nieuw = data.bonnen.filter((b) => b && b.id && !local.has(b.id));
    let i = 0;
    for (const b of nieuw) {
      progress && progress(++i, nieuw.length);
      let foto = null; try { foto = await getFoto(b); } catch (e) {}
      const { fotoBestand, fotoData, ...rest } = b;
      await window.BB.put({ ...rest, foto: foto || undefined });
    }
    const L = window.BB.lijsten(), D = window.BB.normalize(data.lijsten);
    const merged = { gebruikers: [...L.gebruikers, ...D.gebruikers], per: { ...L.per } };
    for (const [naam, v] of Object.entries(D.per)) {
      const mine = merged.per[naam] || { projecten: [], passen: [] };
      merged.per[naam] = { projecten: [...mine.projecten, ...v.projecten], passen: [...mine.passen, ...v.passen] };
      const foto = mine.foto || v.foto; if (foto) merged.per[naam].foto = foto;
    }
    await window.BB.setLijsten(merged);
    await window.BB.reload();
    const extra = {};
    for (const [k, m] of Object.entries(window.BBV || {})) extra[k] = Array.isArray(data[k]) ? await m.merge(data[k], getFoto) : 0;
    return { n: nieuw.length, sg: extra.statiegeld || 0, ca: extra.cadeau || 0, re: extra.reserveringen || 0 };
  }
  const t = window.I18N.t;
  const doneText = ({ n, sg, ca, re }) => {
    if (!n && !sg && !ca && !re) return t("Klaar. Er waren geen nieuwe bonnen om te importeren.");
    const parts = [];
    if (n) parts.push(n === 1 ? t("1 bon") : t("{n} bonnen", { n }));
    if (sg) parts.push(sg === 1 ? t("1 statiegeldbon") : t("{n} statiegeldbonnen", { n: sg }));
    if (ca) parts.push(ca === 1 ? t("1 cadeaubon") : t("{n} cadeaubonnen", { n: ca }));
    if (re) parts.push(re === 1 ? t("1 reservering") : t("{n} reserveringen", { n: re }));
    return t("Klaar. {x} geïmporteerd.", { x: parts.join(t(" en ")) });
  };

  // ---------- back-upbestand op dit apparaat ----------
  $("fileExport").addEventListener("click", async () => {
    busy(true); msg("Back-up maken…");
    try {
      const all = await window.BB.all();
      const data = await buildBackup();
      for (let i = 0; i < all.length; i++) if (all[i].foto instanceof Blob) data.bonnen[i].fotoData = await blobToB64(all[i].foto);
      for (const [k, m] of Object.entries(window.BBV || {})) { const list = await m.all(); for (let i = 0; i < list.length; i++) if (list[i].foto instanceof Blob) data[k][i].fotoData = await blobToB64(list[i].foto); }
      const file = new File([JSON.stringify(data)], `bb-backup-${window.BB.today()}.json`, { type: "application/json" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try { await navigator.share({ files: [file], title: "BB back-up" }); msg("Back-up gedeeld."); } catch (e) { msg(""); }
      } else {
        const u = URL.createObjectURL(file); const a = document.createElement("a"); a.href = u; a.download = file.name; document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(u), 4000); msg("Back-up opgeslagen in je downloads.");
      }
    } catch (e) { msg("De back-up kon niet worden gemaakt.", true); }
    finally { busy(false); }
  });
  $("fileImport").addEventListener("change", async (e) => {
    const f = e.target.files && e.target.files[0]; e.target.value = ""; if (!f) return;
    busy(true); msg("Back-up inlezen…");
    try {
      const data = JSON.parse(await f.text());
      const n = await mergeBackup(data, async (b) => b.fotoData ? b64ToBlob(b.fotoData, "image/jpeg") : null, (i, t) => msg(`Importeren… ${i} van ${t}`));
      msg(doneText(n));
    } catch (err) { msg("Dit bestand is geen BB-back-up of is beschadigd.", true); }
    finally { busy(false); }
  });

  // ---------- Dropbox (OAuth met PKCE, geen geheime sleutel nodig) ----------
  const DBX = {
    key: CFG.dropboxAppKey,
    async token() {
      const s = await window.BB.getSetting("dropbox");
      if (s && s.access && s.expires > Date.now() + 60000) return s.access;
      if (!s || !s.refresh) return null;
      const r = await fetch("https://api.dropboxapi.com/oauth2/token", { method: "POST", body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: s.refresh, client_id: this.key }) });
      if (!r.ok) { await window.BB.putSetting("dropbox", null); return null; }
      const j = await r.json();
      await window.BB.putSetting("dropbox", { ...s, access: j.access_token, expires: Date.now() + j.expires_in * 1000 });
      return j.access_token;
    },
    async login(action) {
      const verifier = rand(64);
      const challenge = await sha256b64url(verifier);
      const stateStr = rand(16);
      try { sessionStorage.setItem("bb-dbx", JSON.stringify({ verifier, state: stateStr, action })); } catch (e) {}
      location.href = "https://www.dropbox.com/oauth2/authorize?" + new URLSearchParams({ client_id: this.key, response_type: "code", code_challenge: challenge, code_challenge_method: "S256", redirect_uri: REDIRECT, token_access_type: "offline", state: stateStr });
    },
    async finishLogin() {
      const q = new URLSearchParams(location.search); const code = q.get("code"), st = q.get("state");
      if (!code) return null;
      let saved = null; try { saved = JSON.parse(sessionStorage.getItem("bb-dbx") || "null"); sessionStorage.removeItem("bb-dbx"); } catch (e) {}
      history.replaceState(null, "", REDIRECT);
      if (!saved || saved.state !== st) return null;
      const r = await fetch("https://api.dropboxapi.com/oauth2/token", { method: "POST", body: new URLSearchParams({ code, grant_type: "authorization_code", code_verifier: saved.verifier, client_id: this.key, redirect_uri: REDIRECT }) });
      if (!r.ok) throw new Error("dbx-token");
      const j = await r.json();
      await window.BB.putSetting("dropbox", { refresh: j.refresh_token, access: j.access_token, expires: Date.now() + j.expires_in * 1000 });
      return saved.action;
    },
    async upload(tok, path, body) {
      const r = await fetch("https://content.dropboxapi.com/2/files/upload", { method: "POST", headers: { Authorization: "Bearer " + tok, "Content-Type": "application/octet-stream", "Dropbox-API-Arg": JSON.stringify({ path, mode: "overwrite", mute: true }) }, body });
      if (!r.ok) throw new Error("dbx-upload " + r.status);
    },
    async download(tok, path) {
      const r = await fetch("https://content.dropboxapi.com/2/files/download", { method: "POST", headers: { Authorization: "Bearer " + tok, "Dropbox-API-Arg": JSON.stringify({ path }) } });
      if (r.status === 409) return null;
      if (!r.ok) throw new Error("dbx-download " + r.status);
      return r.blob();
    },
    async list(tok, path) {
      const names = new Set();
      let r = await fetch("https://api.dropboxapi.com/2/files/list_folder", { method: "POST", headers: { Authorization: "Bearer " + tok, "Content-Type": "application/json" }, body: JSON.stringify({ path }) });
      if (r.status === 409) return names;
      for (;;) {
        if (!r.ok) throw new Error("dbx-list " + r.status);
        const j = await r.json(); j.entries.forEach((e) => names.add(e.name));
        if (!j.has_more) return names;
        r = await fetch("https://api.dropboxapi.com/2/files/list_folder/continue", { method: "POST", headers: { Authorization: "Bearer " + tok, "Content-Type": "application/json" }, body: JSON.stringify({ cursor: j.cursor }) });
      }
    },
  };
  async function dropboxExport(tok) {
    const all = await window.BB.all();
    const have = await DBX.list(tok, "/fotos");
    const todo = (await allPhotos()).filter((f) => !have.has(f.name));
    let i = 0;
    for (const f of todo) { msg(`Foto's uploaden naar Dropbox… ${++i} van ${todo.length}`); await DBX.upload(tok, "/fotos/" + f.name, f.blob); }
    msg("Overzicht opslaan in Dropbox…");
    await DBX.upload(tok, "/bonnen.csv", new Blob([window.BB.csvText(all)], { type: "text/csv" }));
    await DBX.upload(tok, "/backup.json", new Blob([JSON.stringify(await buildBackup())], { type: "application/json" }));
    msg(`Klaar. ${all.length === 1 ? "1 bon staat" : all.length + " bonnen staan"} in Dropbox, in de map Apps › ${CFG.dropboxFolderName || "BB"}.`);
  }
  async function dropboxImport(tok) {
    msg("Back-up ophalen uit Dropbox…");
    const blob = await DBX.download(tok, "/backup.json");
    if (!blob) { msg("Er staat nog geen back-up in Dropbox. Exporteer eerst vanaf het apparaat met de bonnen.", true); return; }
    const n = await mergeBackup(JSON.parse(await blob.text()), (b) => DBX.download(tok, "/fotos/" + b.fotoBestand), (i, t) => msg(`Importeren uit Dropbox… ${i} van ${t}`));
    msg(doneText(n));
  }
  async function runDropbox(action) {
    if (!DBX.key) { msg("Dropbox is nog niet ingesteld. De app-sleutel van Dropbox moet nog in config.js worden gezet.", true); return; }
    busy(true);
    try {
      const tok = await DBX.token();
      if (!tok) { msg("Doorsturen naar Dropbox om in te loggen…"); await DBX.login(action); return; }
      await (action === "import" ? dropboxImport(tok) : dropboxExport(tok));
    } catch (e) { msg("Er ging iets mis met Dropbox. Controleer je internetverbinding en probeer het opnieuw.", true); }
    finally { busy(false); }
  }
  $("dbxExport").addEventListener("click", () => runDropbox("export"));
  $("dbxImport").addEventListener("click", () => runDropbox("import"));

  // ---------- Google Drive (Google Identity Services, alleen bestanden die BB zelf maakt) ----------
  const GD = {
    id: CFG.googleClientId, client: null, tok: null, exp: 0, loading: null,
    load() {
      if (window.google && google.accounts && google.accounts.oauth2) return Promise.resolve();
      if (!this.loading) this.loading = new Promise((res, rej) => { const s = document.createElement("script"); s.src = "https://accounts.google.com/gsi/client"; s.async = true; s.onload = res; s.onerror = () => { this.loading = null; rej(new Error("gsi")); }; document.head.appendChild(s); });
      return this.loading;
    },
    // Moet direct vanuit een klik worden aangeroepen, anders blokkeert de browser het inlogvenster.
    token() {
      if (this.tok && this.exp > Date.now() + 60000) return Promise.resolve(this.tok);
      return new Promise((res, rej) => {
        if (!(window.google && google.accounts && google.accounts.oauth2)) { rej(new Error("gsi")); return; }
        this.client = google.accounts.oauth2.initTokenClient({
          client_id: this.id, scope: "https://www.googleapis.com/auth/drive.file",
          callback: (r) => { if (r.error || !r.access_token) { rej(new Error(r.error || "token")); return; } this.tok = r.access_token; this.exp = Date.now() + (r.expires_in || 3600) * 1000; res(this.tok); },
          error_callback: (e) => rej(new Error(e && e.type || "popup")),
        });
        this.client.requestAccessToken({ prompt: "" });
      });
    },
    async api(path, opts = {}) {
      const r = await fetch("https://www.googleapis.com" + path, { ...opts, headers: { Authorization: "Bearer " + this.tok, ...(opts.headers || {}) } });
      if (!r.ok) throw new Error("drive " + r.status);
      return r;
    },
    async find(name, parent, folder) {
      const q = [`name='${name.replace(/'/g, "\\'")}'`, "trashed=false", parent ? `'${parent}' in parents` : null, folder ? "mimeType='application/vnd.google-apps.folder'" : null].filter(Boolean).join(" and ");
      const j = await (await this.api("/drive/v3/files?" + new URLSearchParams({ q, fields: "files(id,name)", spaces: "drive", pageSize: "10" }))).json();
      return j.files && j.files[0] ? j.files[0].id : null;
    },
    async folder(name, parent) {
      const found = await this.find(name, parent, true); if (found) return found;
      const body = { name, mimeType: "application/vnd.google-apps.folder" }; if (parent) body.parents = [parent];
      return (await (await this.api("/drive/v3/files?fields=id", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json()).id;
    },
    async names(parent) {
      const out = new Map(); let pageToken = "";
      do {
        const p = { q: `'${parent}' in parents and trashed=false`, fields: "nextPageToken,files(id,name)", pageSize: "1000" }; if (pageToken) p.pageToken = pageToken;
        const j = await (await this.api("/drive/v3/files?" + new URLSearchParams(p))).json();
        (j.files || []).forEach((f) => out.set(f.name, f.id)); pageToken = j.nextPageToken || "";
      } while (pageToken);
      return out;
    },
    async put(name, parent, blob, existingId) {
      if (existingId) { await this.api(`/upload/drive/v3/files/${existingId}?uploadType=media`, { method: "PATCH", headers: { "Content-Type": blob.type || "application/octet-stream" }, body: blob }); return; }
      const form = new FormData();
      form.append("metadata", new Blob([JSON.stringify({ name, parents: [parent] })], { type: "application/json" }));
      form.append("file", blob);
      await this.api("/upload/drive/v3/files?uploadType=multipart&fields=id", { method: "POST", body: form });
    },
    async get(id) { return (await this.api(`/drive/v3/files/${id}?alt=media`)).blob(); },
  };
  async function driveExport() {
    msg("Map Bonnenbak zoeken in Google Drive…");
    const root = await GD.folder("Bonnenbak"); const fotos = await GD.folder("fotos", root);
    const all = await window.BB.all();
    const have = await GD.names(fotos);
    const todo = (await allPhotos()).filter((f) => !have.has(f.name));
    let i = 0;
    for (const f of todo) { msg(`Foto's uploaden naar Google Drive… ${++i} van ${todo.length}`); await GD.put(f.name, fotos, f.blob); }
    msg("Overzicht opslaan in Google Drive…");
    const top = await GD.names(root);
    await GD.put("bonnen.csv", root, new Blob([window.BB.csvText(all)], { type: "text/csv" }), top.get("bonnen.csv"));
    await GD.put("backup.json", root, new Blob([JSON.stringify(await buildBackup())], { type: "application/json" }), top.get("backup.json"));
    msg(`Klaar. ${all.length === 1 ? "1 bon staat" : all.length + " bonnen staan"} in Google Drive, in de map Bonnenbak.`);
  }
  async function driveImport() {
    msg("Back-up ophalen uit Google Drive…");
    const root = await GD.find("Bonnenbak", null, true);
    const top = root ? await GD.names(root) : new Map();
    if (!top.get("backup.json")) { msg("Er staat nog geen back-up in Google Drive. Exporteer eerst vanaf het apparaat met de bonnen.", true); return; }
    const fotosId = top.get("fotos"); const fotos = fotosId ? await GD.names(fotosId) : new Map();
    const data = JSON.parse(await (await GD.get(top.get("backup.json"))).text());
    const n = await mergeBackup(data, async (b) => fotos.get(b.fotoBestand) ? GD.get(fotos.get(b.fotoBestand)) : null, (i, t) => msg(`Importeren uit Google Drive… ${i} van ${t}`));
    msg(doneText(n));
  }
  function runDrive(action) {
    if (!GD.id) { msg("Google Drive is nog niet ingesteld. De client-ID van Google moet nog in config.js worden gezet.", true); return; }
    busy(true); msg("Inloggen bij Google…");
    GD.token()
      .then(() => (action === "import" ? driveImport() : driveExport()))
      .catch((e) => msg(/popup|gsi/.test(String(e && e.message)) ? "Het inlogvenster van Google kon niet openen. Sta pop-ups toe voor deze site en probeer het opnieuw." : /access_denied/.test(String(e && e.message)) ? "Je hebt geen toestemming gegeven voor Google Drive." : "Er ging iets mis met Google Drive. Probeer het opnieuw.", true))
      .finally(() => busy(false));
  }
  $("gdExport").addEventListener("click", () => runDrive("export"));
  $("gdImport").addEventListener("click", () => runDrive("import"));

  // ---------- hulpjes ----------
  function rand(n) { const a = new Uint8Array(n); crypto.getRandomValues(a); return Array.from(a, (x) => "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~"[x % 66]).join(""); }
  async function sha256b64url(s) {
    const h = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)));
    return btoa(String.fromCharCode(...h)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  // ---------- start ----------
  $("dbxState").textContent = DBX.key ? "" : "nog niet ingesteld";
  $("gdState").textContent = GD.id ? "" : "nog niet ingesteld";
  if (GD.id) GD.load().catch(() => {});
  if (new URLSearchParams(location.search).get("error")) { history.replaceState(null, "", REDIRECT); msg("Je hebt geen toestemming gegeven voor Dropbox.", true); }
  if (DBX.key) {
    DBX.token().then((t) => { $("dbxState").textContent = t ? "gekoppeld" : ""; }).catch(() => {});
    if (new URLSearchParams(location.search).get("code")) {
      // Terug van het inloggen bij Dropbox: ga verder met wat je wilde doen.
      document.querySelector('nav button[data-view="bonnen"]').click();
      busy(true); msg("Inloggen bij Dropbox afronden…");
      DBX.finishLogin().then((action) => { busy(false); $("dbxState").textContent = "gekoppeld"; if (action) runDropbox(action); else msg(""); })
        .catch(() => { busy(false); msg("Inloggen bij Dropbox is niet gelukt. Probeer het opnieuw.", true); });
    }
  }
})();
