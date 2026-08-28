# Źródła danych

GROM nie produkuje obserwacji. Składa publiczne źródła i liczy nowcast **na urządzeniu / serwerze aplikacji**. To nie jest produkt IMGW ani RCB.

## Radar

| | |
|---|---|
| Dostawca kafelków | [RainViewer](https://www.rainviewer.com/) Public API |
| Endpoint map | `https://api.rainviewer.com/public/weather-maps.json` |
| Siatka | POLRAD (IMGW-PIB), RainViewer kompozytuje i koloruje |
| Kolorystyka | Universal Blue (`…/2/1_1.png`) |
| Zoom analizy | 5 (wyższe poziomy często puste) |

RainViewer bywa używany w produktach non-commercial zgodnie z ich aktualnym regulaminem. Przed komercją: przeczytaj [rainviewer.com](https://www.rainviewer.com/) / API terms. **Nie cache’ujemy klatek na dysku ani w repo.**

Sieć radarowa POLRAD należy do **Instytutu Meteorologii i Gospodarki Wodnej – Państwowego Instytutu Badawczego**. W UI jest stała atrybucja. Dane w GROM są **przetworzone** (próbkowanie, klastry, wektory) — nie wolno ich przedstawiać jako surowy produkt IMGW.

## Ostrzeżenia

| | |
|---|---|
| API | `https://danepubliczne.imgw.pl/api/data/warningsmeteo` |
| Dopasowanie | kod TERYT 4 cyfry (powiat / miasto na prawach powiatu) |
| Filtr burzowy | nazwa zdarzenia: burz, grad, silny deszcz |

To ostrzeżenia **oficjalne, powiatowe**. GROM pokazuje je obok nowcastu, nie zamiast. Nie zastępuje RCB.

## Geokodowanie i mapa

- Wyszukiwarka i reverse: **Nominatim** (OpenStreetMap), `countrycodes=pl`, language `pl`. Szanujemy usage policy (User-Agent, brak hammerowania).
- Podkład: **OpenFreeMap** styl Positron (OSM). Fallback Esri World Light Gray.
- Miasta z listy: ręczne współrzędne + TERYT w [`src/lib/weather/cities.ts`](../src/lib/weather/cities.ts).

## Czego nie trzymamy

- Plików PNG radaru
- Historii skanów poza kilkoma klatkami w RAM
- Kont użytkowników, bazy, telemetrii lokalizacji (MVP)
- Kluczy API map (nie są potrzebne)

Ustawienia (pinezka, promień, notify) → `localStorage` klucz `grom-settings-v1`.

## Atrybucja (kopia do UI)

> Źródłem danych ostrzeżeń i sieci POLRAD jest Instytut Meteorologii i Gospodarki Wodnej – Państwowy Instytut Badawczy. Dane radarowe zostały przetworzone. Radar: RainViewer. Mapa: OpenFreeMap / OSM. To nie jest oficjalny alert RCB.

Przy zmianie źródła — zaktualizuj ten tekst w [`src/components/grom-app.tsx`](../src/components/grom-app.tsx) i tutaj.
