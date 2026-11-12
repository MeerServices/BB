/* BB — taal: Nederlands (standaard) of English (US).
 * In het Engels vertaalt BB de hele pagina, ook teksten die later verschijnen.
 * Nieuwe teksten: voeg de Nederlandse tekst met vertaling toe aan EN, of een regel aan PATTERNS. */
(() => {
  "use strict";
  let lang = "nl";
  try { lang = localStorage.getItem("bb-lang") || "nl"; } catch (e) {}
  if (lang !== "en") lang = "nl";

  const EN = {
    // kop en menu
    "Info over BB": "About BB", "Andere gebruiker kiezen": "Choose another user", "Kies wie": "Choose user",
    "Bonnen": "Receipts", "Statiegeld": "Deposits", "Cadeau": "Gift cards", "Lijsten": "Lists",
    "← Terug": "← Back", "Terug": "Back", "← Terug naar bonnen": "← Back to receipts",
    // info
    "BB is je digitale bonnenbak. Maak een foto van elke kassabon en leg meteen vast wie hem heeft betaald, voor welk project, met welke pas of rekening en waarom.":
      "BB is your digital receipt box. Snap a photo of every receipt and record right away who paid, for which project, with which card or account, and why.",
    "Alle bonnen staan overzichtelijk bij elkaar, per project en per pas, met het totaalbedrag erbij. Een bon deel je in één tik via WhatsApp of e-mail, en het hele overzicht zet je zo in Excel, Dropbox of Google Drive.":
      "All receipts are neatly kept together, by project and by card, with the total. Share a receipt in one tap via WhatsApp or email, and send the full overview to Excel, Dropbox or Google Drive.",
    "Zo raak je geen bon meer kwijt en heb je je administratie altijd bij de hand.": "You'll never lose a receipt again, and your records are always at hand.",
    "© 2026 Vipware. Alle rechten voorbehouden.": "© 2026 Vipware. All rights reserved.",
    "Taal": "Language", "Stuur een bedankje": "Send a thank-you", "Blij met BB, of mis je iets? Laat het weten.": "Happy with BB, or missing something? Let us know.",
    "Je bericht": "Your message", "E-mail": "Email",
    "Bedankt voor BB!": "Thanks for BB!", "Het volgende zou interessant zijn om erbij te hebben of te verbeteren:": "The following would be great to add or improve:", "Bedankje voor BB": "Thank-you for BB",
    // gebruiker
    "Wie ben jij?": "Who are you?", "BB onthoudt je keuze. Je kunt later rechtsboven een andere gebruiker kiezen.": "BB remembers your choice. You can pick another user later, top right.",
    "Nieuwe naam": "New name", "Toevoegen": "Add",
    // nieuwe bon
    "Nieuwe bon": "New receipt", "Foto van de bon": "Receipt photo", "Maak een foto met de camera of kies er een uit je galerij.": "Take a photo with the camera or pick one from your gallery.",
    "Camera": "Camera", "Uit galerij": "From gallery", "Foto maken": "Take photo", "Annuleren": "Cancel", "Bon automatisch lezen": "Read receipt automatically",
    "Winkel": "Store", "bijv. Karwei": "e.g. Home Depot", "Datum": "Date", "Bedrag (€)": "Amount (€)", "Bedrag": "Amount", "Wie heeft betaald": "Paid by", "Project": "Project",
    "Pas of rekening": "Card or account", "Reden": "Reason", "Waarvoor is dit gekocht?": "What was this bought for?", "Bon bewaren": "Save receipt", "Bewaren…": "Saving…",
    "Bon bewaard.": "Receipt saved.", "Nog nodig: ": "Still needed: ", "foto": "photo", "bedrag": "amount", "wie": "who", "project": "project", "pas": "card",
    "Deze foto kon niet worden geopend. Probeer een JPG- of PNG-foto.": "This photo couldn't be opened. Try a JPG or PNG photo.",
    "De browser mag de webcam niet gebruiken. Sta de camera toe via het slotje links van het adres, of kies Uit galerij.": "The browser isn't allowed to use the webcam. Allow the camera via the lock icon next to the address, or choose From gallery.",
    "Er is geen webcam gevonden op deze computer. Kies Uit galerij.": "No webcam was found on this computer. Choose From gallery.",
    "De webcam kon niet worden gestart. Kies Uit galerij.": "The webcam couldn't be started. Choose From gallery.",
    "Leesprogramma laden…": "Loading reader…", "Bon wordt gelezen…": "Reading receipt…",
    "Er was niets leesbaars op de foto te vinden. Vul de gegevens zelf in.": "Nothing readable was found in the photo. Please fill in the details yourself.",
    "De bon kon niet worden gelezen. Controleer je internetverbinding of vul de gegevens zelf in.": "The receipt couldn't be read. Check your internet connection or fill in the details yourself.",
    "Bewaren is mislukt. Misschien is de opslag van je telefoon vol.": "Saving failed. Your phone's storage may be full.",
    "Leeg, zie Lijsten": "Empty, see Lists", "Kies project": "Choose project", "Kies pas of rekening": "Choose card or account",
    // bonnen
    "Pas": "Card", "Alle projecten": "All projects", "Alle passen": "All cards", "Overzicht delen (CSV)": "Share overview (CSV)", "Overzicht bonnen": "Receipts overview",
    "Nog geen bonnen. Tik op <b>Nieuwe bon</b> om je eerste bon toe te voegen.": "No receipts yet. Tap <b>New receipt</b> to add your first one.",
    "Onbekende winkel": "Unknown store", "onbekende winkel": "unknown store", "1 bon": "1 receipt", "Bon": "Receipt",
    "Gekocht door": "Bought by", "Betaald met": "Paid with", "Foto": "Photo",
    // detail
    "Delen": "Share", "Delen met foto": "Share with photo", "Foto opslaan": "Save photo", "WhatsApp (alleen tekst)": "WhatsApp (text only)", "E-mail (alleen tekst)": "Email (text only)",
    "Met <b>Delen met foto</b> kies je zelf WhatsApp, Gmail of een andere app. De foto en de gegevens gaan dan samen mee.": "With <b>Share with photo</b> you pick WhatsApp, Gmail or another app. The photo and the details are sent together.",
    "Bon verwijderen": "Delete receipt", "Deze bon en de foto definitief verwijderen?": "Permanently delete this receipt and its photo?", "Ja, verwijderen": "Yes, delete",
    "Delen is niet gelukt. Probeer WhatsApp of e-mail met alleen tekst.": "Sharing failed. Try WhatsApp or email with text only.",
    "Foto opgeslagen. Voeg hem toe aan je WhatsApp- of e-mailbericht.": "Photo saved. Add it to your WhatsApp or email message.",
    "Verwijderen is mislukt. Probeer het opnieuw.": "Deleting failed. Please try again.",
    // export en import
    "Export en import": "Export and import",
    "Exporteren zet alle bonnen, de foto's en een overzicht (CSV) in je Dropbox of Google Drive. Importeren haalt bonnen op die nog niet op dit apparaat staan, bijvoorbeeld op een nieuwe telefoon.":
      "Export puts all receipts, photos and an overview (CSV) in your Dropbox or Google Drive. Import fetches receipts that aren't on this device yet, for example on a new phone.",
    "Exporteren": "Export", "Importeren": "Import", "Back-upbestand": "Backup file", "Opslaan": "Save", "Inlezen": "Load", "nog niet ingesteld": "not set up yet", "gekoppeld": "connected",
    "Back-up maken…": "Creating backup…", "BB back-up": "BB backup", "Back-up gedeeld.": "Backup shared.", "Back-up opgeslagen in je downloads.": "Backup saved to your downloads.",
    "De back-up kon niet worden gemaakt.": "The backup couldn't be created.", "Back-up inlezen…": "Loading backup…", "Dit bestand is geen BB-back-up of is beschadigd.": "This file isn't a BB backup or is damaged.",
    "Klaar. Er waren geen nieuwe bonnen om te importeren.": "Done. There were no new receipts to import.", "Klaar. {x} geïmporteerd.": "Done. Imported {x}.", " en ": " and ",
    "{n} bonnen": "{n} receipts", "1 statiegeldbon": "1 deposit voucher", "{n} statiegeldbonnen": "{n} deposit vouchers", "1 cadeaubon": "1 gift card", "{n} cadeaubonnen": "{n} gift cards",
    "Overzicht opslaan in Dropbox…": "Saving overview to Dropbox…", "Back-up ophalen uit Dropbox…": "Fetching backup from Dropbox…",
    "Er staat nog geen back-up in Dropbox. Exporteer eerst vanaf het apparaat met de bonnen.": "There's no backup in Dropbox yet. Export from the device with the receipts first.",
    "Doorsturen naar Dropbox om in te loggen…": "Redirecting to Dropbox to sign in…", "Er ging iets mis met Dropbox. Controleer je internetverbinding en probeer het opnieuw.": "Something went wrong with Dropbox. Check your internet connection and try again.",
    "Dropbox is nog niet ingesteld. De app-sleutel van Dropbox moet nog in config.js worden gezet.": "Dropbox isn't set up yet. The Dropbox app key still needs to be added to config.js.",
    "Google Drive is nog niet ingesteld. De client-ID van Google moet nog in config.js worden gezet.": "Google Drive isn't set up yet. The Google client ID still needs to be added to config.js.",
    "Map Bonnenbak zoeken in Google Drive…": "Looking for the Bonnenbak folder in Google Drive…", "Overzicht opslaan in Google Drive…": "Saving overview to Google Drive…",
    "Back-up ophalen uit Google Drive…": "Fetching backup from Google Drive…", "Er staat nog geen back-up in Google Drive. Exporteer eerst vanaf het apparaat met de bonnen.": "There's no backup in Google Drive yet. Export from the device with the receipts first.",
    "Inloggen bij Google…": "Signing in to Google…", "Het inlogvenster van Google kon niet openen. Sta pop-ups toe voor deze site en probeer het opnieuw.": "Google's sign-in window couldn't open. Allow pop-ups for this site and try again.",
    "Je hebt geen toestemming gegeven voor Google Drive.": "You didn't grant access to Google Drive.", "Er ging iets mis met Google Drive. Probeer het opnieuw.": "Something went wrong with Google Drive. Please try again.",
    "Je hebt geen toestemming gegeven voor Dropbox.": "You didn't grant access to Dropbox.", "Inloggen bij Dropbox afronden…": "Finishing Dropbox sign-in…", "Inloggen bij Dropbox is niet gelukt. Probeer het opnieuw.": "Dropbox sign-in failed. Please try again.",
    // lijsten
    "Projecten en passen horen bij de gebruiker die nu gekozen is. Kies rechtsboven een andere gebruiker om diens lijsten te zien.": "Projects and cards belong to the current user. Pick another user top right to see their lists.",
    "Pasfoto van": "Profile photo of", "Selfie": "Selfie", "Verwijderen": "Delete", "Gebruikers": "Users", "Naam toevoegen": "Add name",
    "Projecten van": "Projects of", "Project toevoegen": "Add project", "Passen en rekeningen van": "Cards and accounts of", "bijv. Zakelijke pin ING": "e.g. Business debit card", "Pas toevoegen": "Add card", "Nog leeg.": "Empty.",
    // statiegeld en cadeau
    "Scannen": "Scan", "Typen": "Type", "Houd de streepjescode binnen het kader. Scannen gaat vanzelf.": "Keep the barcode inside the frame. It scans automatically.",
    "Foto kiezen": "Choose photo", "Tekst van de foto lezen": "Read text from photo", "Nummer van de streepjescode": "Barcode number", "BonNr.": "Receipt no.",
    "Pincode": "PIN", "pincode": "PIN", "Gekregen van": "Received from", "Geldig tot": "Valid until", "geldig tot": "valid until", "Instructie": "Instructions",
    "Bijv. alleen in de winkel, online inwisselen via de website, saldo checken op ...": "E.g. in store only, redeem online via the website, check balance at ...",
    "Memo": "Memo", "memo": "memo", "Extra info. Tekst die van de foto gelezen wordt, komt hier.": "Extra info. Text read from the photo goes here.",
    "Open": "Open", "Verlopen": "Expired", "Alle": "All", "Meldingen aanzetten": "Turn on notifications", "Bewerken": "Edit", "Herinnering in agenda": "Add calendar reminder",
    "Definitief verwijderen?": "Delete permanently?", "Laatste dag": "Last day", "Nog 1 dag": "1 day left", "Nog {n} dagen": "{n} days left",
    "{x} bewerken": "Edit {x}", "Nieuwe {x}": "New {x}", "Wijzigingen bewaren": "Save changes", "{x} bewaren": "Save {x}", "{x} bewaard.": "{x} saved.",
    "Deze foto kon niet worden geopend.": "This photo couldn't be opened.", "Tekst lezen…": "Reading text…", "Tekst lezen… {n}%": "Reading text… {n}%",
    "winkel": "store", "datum": "date", "Ingevuld: {x}. Controleer het even.": "Filled in: {x}. Please check.", "Er was geen tekst te lezen op de foto.": "No text could be read from the photo.",
    "De tekst kon niet worden gelezen. Controleer je internetverbinding.": "The text couldn't be read. Check your internet connection.",
    "Vul het nummer van de streepjescode in, of scan de bon.": "Enter the barcode number, or scan the voucher.", "Deze bon staat er al in.": "This voucher is already saved.",
    "Streepjescode zoeken…": "Looking for barcode…", "Streepjescode zoeken… {n}%": "Looking for barcode… {n}%",
    "Er is geen streepjescode gevonden. Typ het nummer onder de streepjes over, of probeer een scherpere foto.": "No barcode was found. Type the number under the bars, or try a sharper photo.",
    "BB mag de camera niet gebruiken. Sta de camera toe in je browser, of kies Uit galerij.": "BB isn't allowed to use the camera. Allow the camera in your browser, or choose From gallery.",
    "De camera kon niet worden gestart. Kies Uit galerij of Typen.": "The camera couldn't be started. Choose From gallery or Type.",
    "1 open bon": "1 open voucher", "{n} open bonnen": "{n} open vouchers",
    "1 {x} verloopt binnen {d} dagen.": "1 {x} expires within {d} days.", "{n} {x} verlopen binnen {d} dagen.": "{n} {x} expire within {d} days.",
    "Niets in deze lijst.": "Nothing in this list.", "Nummer": "Number", "Status": "Status", "door {x}": "by {x}", "op {d}": "on {d}", "t/m": "until",
    "Opslaan is mislukt.": "Saving failed.", "Verwijderen is mislukt.": "Deleting failed.", "Tekst gekopieerd. Plak hem in je bericht.": "Text copied. Paste it into your message.",
    "Delen kan niet in deze browser. Gebruik WhatsApp of E-mail.": "Sharing isn't available in this browser. Use WhatsApp or Email.",
    "{x} {w} verloopt": "{x} {w} expires", "Agendabestand opgeslagen. Open het om de herinnering aan je agenda toe te voegen.": "Calendar file saved. Open it to add the reminder to your calendar.",
    "statiegeldbon": "deposit voucher", "statiegeldbonnen": "deposit vouchers", "Statiegeldbon": "Deposit voucher", "Open tegoed": "Open credit", "Gebruikt": "Used",
    "bijv. Albert Heijn": "e.g. Walmart", "Datum bon": "Voucher date",
    "Nog geen statiegeldbonnen. Tik op <b>Scannen</b> en houd de streepjescode voor de camera.": "No deposit vouchers yet. Tap <b>Scan</b> and hold the barcode in front of the camera.",
    "cadeaubon": "gift card", "cadeaubonnen": "gift cards", "Cadeaubon": "Gift card", "Totale waarde": "Total value", "Opgemaakt": "Used up", "Waarde (€)": "Value (€)", "Waarde": "Value",
    "Winkel of uitgever": "Store or issuer", "bijv. VVV, Bol, Intertoys": "e.g. Amazon, Target, Visa", "Ontvangen op": "Received on",
    "Nog geen cadeaubonnen. Tik op <b>Scannen</b> of <b>Typen</b> om je eerste cadeaubon toe te voegen.": "No gift cards yet. Tap <b>Scan</b> or <b>Type</b> to add your first gift card.",
    "Filter": "Filter", "Taal ": "Language",
  };
  // Teksten met getallen of namen erin.
  const PATTERNS = [
    [/^(\d+) bonnen$/, "$1 receipts"],
    [/^Bon wordt gelezen… (\d+)%$/, "Reading receipt… $1%"],
    [/^Importeren… (\d+) van (\d+)$/, "Importing… $1 of $2"],
    [/^Importeren uit (Dropbox|Google Drive)… (\d+) van (\d+)$/, "Importing from $1… $2 of $3"],
    [/^Foto's uploaden naar (Dropbox|Google Drive)… (\d+) van (\d+)$/, "Uploading photos to $1… $2 of $3"],
    [/^Klaar\. 1 bon staat in Dropbox, in de map Apps › (.+)\.$/, "Done. 1 receipt is in Dropbox, in the folder Apps › $1."],
    [/^Klaar\. (\d+) bonnen staan in Dropbox, in de map Apps › (.+)\.$/, "Done. $1 receipts are in Dropbox, in the folder Apps › $2."],
    [/^Klaar\. 1 bon staat in Google Drive, in de map Bonnenbak\.$/, "Done. 1 receipt is in Google Drive, in the Bonnenbak folder."],
    [/^Klaar\. (\d+) bonnen staan in Google Drive, in de map Bonnenbak\.$/, "Done. $1 receipts are in Google Drive, in the Bonnenbak folder."],
    [/^Ingevuld: (.+)\. Controleer het even, want lezen gaat niet altijd goed\.$/, (m, x) => `Filled in: ${x.replace(/winkel/g, "store").replace(/datum/g, "date").replace(/bedrag/g, "amount")}. Please check, reading isn't always perfect.`],
    [/^Nog nodig: (.+)\.$/, (m, x) => `Still needed: ${x.split(", ").map((w) => EN[w] || w).join(", ")}.`],
    [/^Pasfoto van (.+)$/, "Profile photo of $1"], [/^Projecten van (.+)$/, "Projects of $1"], [/^Passen en rekeningen van (.+)$/, "Cards and accounts of $1"],
    [/^(.+) verwijderen$/, "Delete $1"],
  ];

  function t(s, vars) {
    let out = lang === "en" && Object.prototype.hasOwnProperty.call(EN, s) ? EN[s] : s;
    if (vars) out = out.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
    return out;
  }
  function tr(s) {
    if (Object.prototype.hasOwnProperty.call(EN, s)) return EN[s];
    for (const [re, rep] of PATTERNS) if (re.test(s)) return s.replace(re, rep);
    return null;
  }
  const eur = (n) => {
    const v = Number(n) || 0;
    return lang === "en" ? "€" + v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "€ " + v.toLocaleString("nl-NL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };
  const date = (iso) => { if (!iso) return "–"; const [y, m, d] = String(iso).split("-"); if (!(d && m && y)) return iso; return lang === "en" ? `${m}/${d}/${y}` : `${d}-${m}-${y}`; };

  // ---------- de pagina vertalen (alleen in het Engels) ----------
  const ATTRS = ["placeholder", "aria-label", "title", "alt"];
  function textNode(n) {
    const raw = n.data, key = raw.trim(); if (!key) return;
    const x = tr(key); if (x != null && x !== key) n.data = raw.replace(key, x);
  }
  function element(e) {
    if (e.nodeType !== 1 || e.closest("[data-no-i18n]")) return;
    if (e.hasAttribute("data-i18n")) { const k = e.innerHTML.trim(); if (EN[k]) e.innerHTML = EN[k]; }
    for (const a of ATTRS) if (e.hasAttribute(a)) { const v = e.getAttribute(a), x = tr(v.trim()); if (x != null && x !== v) e.setAttribute(a, x); }
  }
  function walk(root) {
    if (root.nodeType === 3) { if (!(root.parentElement && root.parentElement.closest("[data-no-i18n],script,style,textarea"))) textNode(root); return; }
    if (root.nodeType !== 1 || /^(SCRIPT|STYLE|TEXTAREA)$/.test(root.tagName)) return;
    element(root);
    root.querySelectorAll("*").forEach(element);
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (n.parentElement && n.parentElement.closest("[data-no-i18n],script,style,textarea") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT) });
    const list = []; while (w.nextNode()) list.push(w.currentNode); list.forEach(textNode);
  }
  function start() {
    document.documentElement.lang = lang === "en" ? "en-US" : "nl";
    document.querySelectorAll("[data-lang]").forEach((b) => {
      b.setAttribute("aria-pressed", String(b.dataset.lang === lang));
      b.addEventListener("click", () => { if (b.dataset.lang === lang) return; try { localStorage.setItem("bb-lang", b.dataset.lang); } catch (e) {} location.reload(); });
    });
    if (lang !== "en") return;
    walk(document.body);
    new MutationObserver((muts) => {
      for (const m of muts) {
        if (m.type === "characterData") { if (!(m.target.parentElement && m.target.parentElement.closest("[data-no-i18n],textarea"))) textNode(m.target); }
        else if (m.type === "attributes") element(m.target);
        else m.addedNodes.forEach(walk);
      }
    }).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();

  window.I18N = { get lang() { return lang; }, t, eur, date, locale: lang === "en" ? "en-US" : "nl-NL" };
})();
