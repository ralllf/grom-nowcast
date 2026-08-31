# Źródła danych

GROM nie produkuje obserwacji. Składa publiczne źródła i liczy nowcast **na urządzeniu / serwerze aplikacji**. To nie jest produkt IMGW ani RCB.

## Radar

| | |
|---|---|
| Dostawca kafelków | [RainViewer](https://www.rainviewer.com/) Public API |
| Endpoint map | `https://api.rainviewer.com/public/weather-maps.json` |
| Siatka | POLRAD (IMGW-PIB), RainViewer kompozytuje i koloruje |
| Kolorystyka | Universal Blue, analiza `…/2/0_0.png` (bez wygładzania, bez palety śniegu), mapa `…/2/1_0.png` |
| Tabela kolorów | [rainviewer_api_colors_table.csv](https://www.rainviewer.com/files/rainviewer_api_colors_table.csv) → `src/lib/weather/palette.ts` |
| Zoom analizy | 6 (API dopuszcza ≤ 7; 9 kafelków na klatkę) |
| Limity | ~100 żądań / IP / min; `nowcast[]` i inne palety wyłączone 1 I 2026 |

RainViewer Public API jest do użytku **osobistego / edukacyjnego** z atrybucją „Weather data by RainViewer” ([transition FAQ](https://www.rainviewer.com/api/transition-faq.html)). Przed komercją: inny dostęp albo własne źródło. **Nie cache’ujemy klatek na dysku ani w repo** (w RAM serwera: 8 ostatnich zdekodowanych klatek).

### Alternatywa: IMGW bezpośrednio (do zrobienia)

IMGW-PIB publikuje kompozyt POLRAD jako **dane otwarte** (ustawa o otwartych danych / HVD) w [danepubliczne.imgw.pl/datastore](https://danepubliczne.imgw.pl/datastore): `/Oper/Polrad/Produkty/POLCOMP/` → `COMPO_SRI…` (natężenie mm/h), `COMPO_CMAX_250…` (dBZ), `COMPO_ZHAIL` (prawd. gradu), **co 5 min**, 900×900 px ≈ 1 km, projekcja `+proj=aeqd +lon_0=19.0926 +lat_0=52.3469`, formaty ODIM_H5 i PNG (`_echoOnly.png`). Plus `/Oper/Perun/` (wyładowania, co 1 min). To 2× świeższe niż RainViewer, 10 radarów zamiast 8, i licencja pod produkt. Koszt: parser H5 (`h5wasm`) albo dekod PNG z własną legendą + odwrotne aeqd. Endpointy `meteo.imgw.pl/api/radars/v1/…` (PNG EPSG:3857 co 5 min) działają, ale są nieudokumentowane i ze znakiem wodnym — nie budować na nich.

Sieć radarowa POLRAD należy do **Instytutu Meteorologii i Gospodarki Wodnej – Państwowego Instytutu Badawczego**. W UI jest stała atrybucja. Dane w GROM są **przetworzone** (próbkowanie, klastry, wektory) — nie wolno ich przedstawiać jako surowy produkt IMGW.

## Ostrzeżenia

| | |
|---|---|
| API | `https://danepubliczne.imgw.pl/api/data/warningsmeteo` |
| Dopasowanie | kod TERYT 4 cyfry (powiat / miasto na prawach powiatu) |
| Filtr burzowy | nazwa zdarzenia: burz, grad, silny deszcz |

To ostrzeżenia **oficjalne, powiatowe**. GROM pokazuje je obok nowcastu, nie zamiast. Nie zastępuje RCB.

## Wyładowania (PERUN)

IMGW publishes PERUN on the same datastore: listing `POST /pl/datastore/getFilesList` with `path=Oper/Perun/PERUN_Polska` (form-urlencoded) is public. Files are 1-min `YYYY.MM.DD.HH.MM.ld` + `.ld.csv` (plus `1min_secondaire` / `10min_secondaire`).

**Access, 2026-08-31 (this slice):** every download of a Perun file bounced. POLCOMP on the same `getfiledown` scheme still served a PNG. Failed URLs (do not invent strikes from these):

- `https://danepubliczne.imgw.pl/pl/datastore/getfiledown/Oper/Perun/PERUN_Polska/<file>.ld.csv` → **307** `Location: /datastore` (HTML)
- `https://danepubliczne.imgw.pl/datastore/getfiledown/Oper/Perun/PERUN_Polska/<file>.ld.csv` → same 307
- `https://danepubliczne.imgw.pl/pl/datastore/getfiledown?path=…` / `?file=…` → 307
- `POST /pl/datastore/getfiledown` with `path=` → 303 `/datastore`
- listing href `…/pl/datastore/getfiledownOper/Perun/…` (no slash) → **404**
- `1min_secondaire` / `10min_secondaire` on the slash scheme → 307

The client lists, then tries the POLCOMP-style URL. A bounce ships **no strikes** and the sheet says „Brak wyładowań w tej sesji”. One email to IMGW open-data support is still needed (out of scope for the Slice 5 agent). No Blitzortung.

## Geokodowanie i mapa

- Wyszukiwarka i reverse: **Nominatim** (OpenStreetMap), `countrycodes=pl`, language `pl`. Szanujemy usage policy (User-Agent, brak hammerowania).
- Podkład: **OpenFreeMap** styl Positron (OSM). Fallback Esri World Light Gray.
- Miasta z listy: ręczne współrzędne + TERYT w [`src/lib/weather/cities.ts`](../src/lib/weather/cities.ts) — last-resort TERYT w promieniu 30 km.
- TERYT pinezki: point-in-polygon na uproszczonych granicach powiatów PRG/GUGiK ([`src/lib/weather/powiaty.json`](../src/lib/weather/powiaty.json), ~340 kB, lazy-load). Nominatim `teryt:terc` wygrywa, gdy jest.

## Czego nie trzymamy

- Plików PNG radaru
- Historii skanów poza kilkoma klatkami w RAM
- Kont użytkowników, bazy, telemetrii lokalizacji (MVP)
- Kluczy API map (nie są potrzebne)

Ustawienia (pinezka, promień, notify) → `localStorage` klucz `grom-settings-v1`.

## Atrybucja (kopia do UI)

> Źródłem danych ostrzeżeń i sieci POLRAD jest Instytut Meteorologii i Gospodarki Wodnej – Państwowy Instytut Badawczy. Dane radarowe zostały przetworzone. Radar: RainViewer. Mapa: OpenFreeMap / OSM. To nie jest oficjalny alert RCB.

Przy zmianie źródła — zaktualizuj ten tekst w [`src/components/grom-app.tsx`](../src/components/grom-app.tsx) i tutaj.
