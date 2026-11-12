# Dropbox en Google Drive koppelen

BB heeft voor elke dienst een sleutel nodig. Die sleutels zijn niet geheim, want ze staan altijd zichtbaar in een web-app. Ze komen in `config.js`.

App-adres: `https://meerservices.github.io/BB/`

## Dropbox: App key

1. Ga naar [dropbox.com/developers/apps](https://www.dropbox.com/developers/apps) en kies **Create app**.
2. Kies **Scoped access** en daarna **App folder**. BB ziet dan alleen zijn eigen map in je Dropbox.
3. Geef de app een naam, bijvoorbeeld `BB Vipware`. De naam moet uniek zijn bij Dropbox. Je bestanden komen in Dropbox › Apps › *deze naam*.
4. Ga naar het tabblad **Permissions**, vink `files.metadata.read`, `files.content.write` en `files.content.read` aan, en klik onderaan op **Submit**.
5. Ga terug naar het tabblad **Settings**:
   - Vul bij **OAuth 2 › Redirect URIs** in: `https://meerservices.github.io/BB/` en klik op **Add**.
   - Zet **Allow public clients (Implicit Grant & PKCE)** op **Allow**.
6. Kopieer de **App key** (niet het App secret).

## Google Drive: client-ID

1. Ga naar [console.cloud.google.com](https://console.cloud.google.com/) en maak een nieuw project, bijvoorbeeld `BB`.
2. Zoek **Google Drive API** op en klik op **Enable**.
3. Ga naar **Google Auth Platform** (of **OAuth consent screen**) en klik op **Get started**:
   - App-naam `BB`, je eigen e-mailadres als contact.
   - Doelgroep: **External**.
4. Bij **Data access** voeg je de scope `.../auth/drive.file` toe. BB ziet dan alleen de bestanden die het zelf aanmaakt.
5. Bij **Audience** voeg je onder **Test users** je eigen Google-account toe en die van je collega's. Je kunt de app later ook publiceren, dan is dat niet meer nodig.
6. Ga naar **Clients** › **Create client** › **Web application**:
   - Vul bij **Authorized JavaScript origins** in: `https://meerservices.github.io`
   - Klik op **Create** en kopieer de **Client ID** (eindigt op `.apps.googleusercontent.com`).

## Invullen

Zet beide sleutels in `config.js`:

```js
window.BB_CONFIG = {
  dropboxAppKey: "jouw-app-key",
  dropboxFolderName: "BB Vipware",
  googleClientId: "1234-abc.apps.googleusercontent.com",
};
```

## Wat er gebeurt

- **Exporteren** zet `backup.json`, `bonnen.csv` en de map `fotos` in Dropbox (Apps › app-naam) of in Google Drive (map `Bonnenbak`). Foto's die er al staan, worden niet opnieuw geüpload.
- **Importeren** haalt bonnen op die nog niet op het apparaat staan en vult de lijsten aan. Een bon die je op het ene apparaat verwijdert, blijft op het andere bestaan.
- Bij Google Drive ziet iedereen alleen de bestanden die hij of zij zelf met BB heeft gemaakt. Met Dropbox kun je dezelfde app-map ook met collega's delen via een gedeeld account.
