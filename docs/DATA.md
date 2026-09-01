# Źródła danych

GROM nie produkuje obserwacji. Składa publiczne źródła i liczy nowcast **na urządzeniu / serwerze aplikacji**. To nie jest produkt IMGW ani RCB.

## Radar

### Analiza: IMGW COMPO_SRI (datastore)

| | |
|---|---|
| Produkt | POLCOMP `COMPO_SRI.comp.sri` — surface rain intensity, mm/h |
| Listing | POST `https://danepubliczne.imgw.pl/pl/datastore/getFilesList` z `path=Oper/Polrad/Produkty/POLCOMP/COMPO_SRI.comp.sri` (HTML). **Nie** `/api/data/product/id/COMPO_SRI.comp.sri` — to lustro opóźnione o godziny. |
| Plik | `…/datastore/getfiledown/Oper/Polrad/Produkty/POLCOMP/COMPO_SRI.comp.sri/<YYYYMMDDHHmmss>00dBR.sri.h5` |
| Siatka | **800×800**, nie 900×900. `xscale` ≈ 1163.64 m, `yscale` ≈ 1153.65 m (~1.16 km). ODIM `where`: `+proj=aeqd +lon_0=19.0926 +lat_0=52.3469 +ellps=sphere` (R = 6 370 997 m). |
| Wartości | `quantity=RATE`, `gain=1`, `offset=0`, `nodata=-2`, `undetect=-1` — prawdziwe mm/h, nie Marshall–Palmer z koloru. |
| Kadencja | 5 min; retencja ~3 dni. 10 radarów POLRAD. |
| Dekoder | `h5wasm` + odwrotne aeqd ([`aeqd.ts`](../src/lib/weather/aeqd.ts)). Overlay mapy: jedno PNG 800×800 w czterech klasach legendy (źródło `image` MapLibre, nie serwer kafelków). |

Starsze notatki (900×900 / 1 km) były zgadywaniem z dokumentacji produktu; atrybuty H5 z 31 VIII 2026 rozstrzygają: **800×800**.

### Overlay: własne PNG z SRI (mapa = liczby)

| | |
|---|---|
| Źródło | To samo zdekodowane pole COMPO_SRI co analiza — nie `_echoOnly.png` IMGW i nie kafelki |
| Format | Jedno indeksowane PNG 800×800 na klatkę, 4 kolory legendy + przezroczyste. Źródło `image` MapLibre z narożnikami aeqd (nie serwer kafelków / CDN) |
| Klasy | Domyślnie klasa ≥ 1 (jak liczby). „Pokaż mżawkę” (domyślnie wył.) maluje 0 < R < 0.1 mm/h kolorem klasy 1 |
| Koszt | Jedno ~50–100 kB PNG / 5 min |
| Fallback | RainViewer `…/2/1_0.png` gdy analiza spadnie na kafelki albo PNG się nie uda |

### Fallback analizy: RainViewer

| | |
|---|---|
| Dostawca kafelków | [RainViewer](https://www.rainviewer.com/) Public API — automatyczny fallback analizy i overlayu |
| Endpoint map | `https://api.rainviewer.com/public/weather-maps.json` |
| Kolorystyka | Universal Blue, overlay `…/2/1_0.png`; fallback analizy `…/2/0_0.png` |
| Zoom fallback | 6 (9 kafelków na klatkę), stride 2 → ~3 km |
| Limity | ~100 żądań / IP / min; `nowcast[]` wyłączone 1 I 2026 |

RainViewer Public API jest do użytku **osobistego / edukacyjnego** z atrybucją „Weather data by RainViewer” ([transition FAQ](https://www.rainviewer.com/api/transition-faq.html)). **Nie cache’ujemy klatek na dysku ani w repo** (w RAM serwera: ostatnie zdekodowane klatki + overlay PNG).

Sieć radarowa POLRAD należy do **Instytutu Meteorologii i Gospodarki Wodnej – Państwowego Instytutu Badawczego**. W UI jest stała atrybucja. Dane w GROM są **przetworzone** (próbkowanie, klastry, wektory) — nie wolno ich przedstawiać jako surowy produkt IMGW. Endpointy `meteo.imgw.pl/api/radars/v1/…` są nieudokumentowane i ze znakiem wodnym — nie budować na nich. CMAX / ZHAIL — po Slice 6.

## Ostrzeżenia

| | |
|---|---|
| API | `https://danepubliczne.imgw.pl/api/data/warningsmeteo` |
| Dopasowanie | kod TERYT 4 cyfry (powiat / miasto na prawach powiatu) |
| Filtr burzowy | nazwa zdarzenia: burz, grad, silny deszcz |

To ostrzeżenia **oficjalne, powiatowe**. GROM pokazuje je obok nowcastu, nie zamiast. Nie zastępuje RCB.

## Wyładowania (PERUN)

IMGW publishes PERUN on the same datastore. Listing is `POST /pl/datastore/getFilesList` with `productType=oper` and a **leading-slash** path (that is how `datastore.js` calls it; without the slash the HTML hrefs become `getfiledownOper/…` and 404).

The official oper product is **LTS2005** (`/Oper/Perun/LTS2005`) — 1-min `CELLS_` / `DENS_` / `DISCH_` GIFs. Those download unauthenticated, same `getfiledown` scheme as POLCOMP. They are maps, not strike points; GROM does not invent lat/lon from pixels.

Point files (`PERUN_Polska` `.ld` / `.ld.csv`, `1min_secondaire`, `TLP/ld/*`) **list** but **do not download**. Live probe **2026-09-01** (not a guess; POLCOMP `.sri.h5` and LTS2005 GIF controls were 200 on the same host):

- `GET …/pl/datastore/getfiledown/Oper/Perun/LTS2005/DISCH_<stamp>.gif` → **200** `image/gif`
- `GET …/pl/datastore/getfiledown/Oper/Polrad/Produkty/POLCOMP/COMPO_SRI.comp.sri/<file>.sri.h5` → **200**
- `GET …/pl/datastore/getfiledown/Oper/Perun/PERUN_Polska/<file>.ld.csv` → **307** `Location: /datastore` (empty HTML)
- same 307 for `1min_secondaire` `.txt` / `.Secondaire` and `TLP/ld/{combined,lf_stroke,vhf_event}` `.ld`
- query/POST `getfiledown`, no-`/pl/` host, session cookie + Referer: still 307
- listing href without the slash after `getfiledown` → **404** (listing-URL quirk; not why the CSVs bounce)

So the Slice 5 “same URL scheme, therefore a typo” hunch is **wrong for the point files**: the scheme works for the published Perun GIFs and for POLCOMP; the strike CSVs are blocked on that subtree. The client still lists `/Oper/Perun/PERUN_Polska` and GETs the slash URL. A bounce ships **no strikes** and the sheet says „Wyładowania chwilowo niedostępne” (not a quiet-sky line). A real CSV is parsed and drawn. No Blitzortung.

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

Ustawienia (pinezka, alerty) → `localStorage` klucz `grom-settings-v1`.

## Atrybucja (kopia do UI)

> Źródłem danych ostrzeżeń i sieci POLRAD jest Instytut Meteorologii i Gospodarki Wodnej – Państwowy Instytut Badawczy. Dane radarowe zostały przetworzone (SRI mm/h IMGW, siatka ~3 km; RainViewer dBZ → Marshall–Palmer gdy SRI niedostępne). Analiza: IMGW COMPO_SRI. Mapa: IMGW SRI (4 klasy) / RainViewer fallback / OpenFreeMap / OSM. To nie jest oficjalny alert RCB.

Przy zmianie źródła — zaktualizuj ten tekst w [`src/components/grom-app.tsx`](../src/components/grom-app.tsx) i tutaj.
