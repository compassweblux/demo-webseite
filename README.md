# La Table du Kirchberg — Demo-Website

Mehrsprachige One-Page-Website (FR / DE / EN / LB) für eine fiktive Brasserie in
Luxemburg-Kirchberg. Statisches HTML/CSS/JS ohne Build-Step, plus ein optionaler
Cloudflare Worker, mit dem der Besitzer das **Plat du jour** selbst vom Handy
ändern kann.

> **Demo-Hinweis:** Betrieb, Adresse und Telefonnummer sind fiktiv.
> Design & Umsetzung: **Compass Web**.

---

## Dateien

| Datei | Zweck |
|---|---|
| `index.html` | Die One-Page-Website |
| `style.css` | Alle Styles (mobile-first, keine Libraries) |
| `script.js` | Sprachwechsel, Scroll-Effekte, Öffnungsstatus, Plat-du-jour-Fetch |
| `translations.js` | Alle Texte in 4 Sprachen |
| `admin/index.html` | Handy-Admin-Seite zum Ändern des Tagesgerichts |
| `worker.js` | Cloudflare Worker (GET/POST `/api/plat-du-jour`, KV, PIN-Auth) |
| `wrangler.toml` | Worker-Konfiguration |

---

## Teil 1 — Website auf Cloudflare Pages deployen

Kein Build-Step nötig.

1. Auf <https://dash.cloudflare.com> → **Workers & Pages** → **Create** → **Pages** → **Upload assets**
   (oder das Git-Repo verbinden).
2. Diesen Ordner hochladen (`index.html`, `style.css`, `script.js`,
   `translations.js`, `admin/`).
3. Fertig — die Seite ist unter `https://<projekt>.pages.dev` erreichbar,
   die Admin-Seite unter `https://<projekt>.pages.dev/admin/`.

**Hinweis:** Solange in `script.js` keine API-URL eingetragen ist, zeigt die
Plat-du-jour-Karte **Demo-Daten** an, damit das Feature im Portfolio sichtbar
bleibt. Nach dem Worker-Deploy (Teil 2) die echte URL eintragen — dann ist die
Karte live und blendet sich automatisch aus, wenn die API nicht erreichbar oder
das Gericht älter als 7 Tage ist.

---

## Teil 2 — Plat-du-jour-Worker deployen

Voraussetzung: [Node.js](https://nodejs.org) installiert, kostenloses
Cloudflare-Konto.

### Schritt 1: Bei Cloudflare anmelden

```bash
npx wrangler login
```

### Schritt 2: KV-Namespace anlegen

```bash
npx wrangler kv namespace create PLAT_DU_JOUR
```

Die Ausgabe enthält eine `id` — diese in `wrangler.toml` bei
`id = "HIER_DIE_KV_NAMESPACE_ID_EINTRAGEN"` eintragen.

### Schritt 3: Admin-PIN als Secret setzen

Das PIN wird **nie** im Code gespeichert, sondern als verschlüsseltes Secret:

```bash
npx wrangler secret put ADMIN_PIN
```

Wenn gefragt, ein PIN eingeben (z. B. 6–8 Ziffern). Dieses PIN gibt der
Besitzer später auf der Admin-Seite ein.

### Schritt 4: Worker deployen

```bash
npx wrangler deploy
```

Die Ausgabe zeigt die Worker-URL, z. B.
`https://plat-du-jour.<ihr-account>.workers.dev`.

### Schritt 5: URLs verdrahten

Die vollständige API-URL lautet:

```
https://plat-du-jour.<ihr-account>.workers.dev/api/plat-du-jour
```

Diese URL an **zwei** Stellen eintragen:

1. **`script.js`** (oben): `var PLAT_API_URL = "…";`
2. **`admin/index.html`** (im `<script>`-Block): `var API_URL = "…";`

Danach die Pages-Seite neu hochladen/deployen.

### Schritt 6: Testen

1. `https://<projekt>.pages.dev/admin/` auf dem Handy öffnen.
2. PIN, Gericht, Preis, Beschreibung eingeben → **Enregistrer**.
3. Hauptseite neu laden → das neue Gericht erscheint in der Karte unter dem
   Hero (die API cached 60 Sekunden — kurze Verzögerung ist normal).

---

## API-Referenz

**GET `/api/plat-du-jour`** — öffentlich, Cache 60 s

```json
{
  "dish": "Blanquette de veau à l'ancienne",
  "price": "24,50 €",
  "description": "Veau fermier, légumes du marché, riz pilaf",
  "updatedAt": "2026-07-13T09:30:00.000Z"
}
```

**POST `/api/plat-du-jour`** — Header `Authorization: Bearer <PIN>`,
Body wie oben ohne `updatedAt`. Antworten: `200` (gespeichert),
`401` (falsches PIN), `400` (ungültige Daten).

---

## Technische Eckdaten

- Kein Framework, keine Libraries — nur Vanilla JS + CSS + Google Fonts
- 4 Sprachen (`translations.js`), Browsersprache wird erkannt, Fallback FR,
  kein localStorage
- Öffnungsstatus rechnet in der Zeitzone `Europe/Luxembourg`
- `prefers-reduced-motion` wird respektiert
- SEO: Meta-Description, Open Graph, schema.org/Restaurant (JSON-LD)
