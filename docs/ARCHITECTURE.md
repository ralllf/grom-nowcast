# Architektura GROM

Nowcast w GROM-ie to trzy warstwy: **pobranie radaru**, **zrozumienie komórek**, **zdanie na pinezkę**.

```text
RainViewer kafelki PNG (z=5, bbox Polski + pas graniczny)
        │  serwer dekoduje pngjs, cache krajowy na timestamp klatki
        ▼
  próbki (lat, lon, level 1–4)  ×  4 skany (~30 min)
        │
        ▼
  masy (flood-fill) → siatka km → smooth dużej skali → NCC (TREC)
        │  QC korelacji; strzałki = pole ruchu (bez pinezki)
        │
        ├── canvas: strzałki z rdzeni mas, długość ∝ prędkość (~30 min)
        └── pinezka: ETA / szansa / ostrzeżenia IMGW z tego samego pola
```

## Pinezka vs promień

| Pojęcie | Dystans | Po co |
|---|---|---|
| **Pinezka** | 5 km (`PIN_KM`) | miasto z listy, punkt z mapy, później dokładny GPS |
| **Lokalny max** | 25 km | „czy nad Tobą jest już echo” |
| **Promień alertu** | 15–80 km, suwak | jak daleko wołamy „opad w okolicy” |
| **Horyzont ETA** | 100 km (`TRACK_MAX_KM`) | dalej niż to nie budujemy narracji „nad Tobą” |
| **Domena radaru** | bbox PL + granica | stałe próbkowanie; nie od pinu, nie cały świat |

Szansa i ETA **nigdy** nie są średnią z całego koła. Koło na mapie to tylko zasięg czujności.

## Radar

- Źródło kafelków: `https://api.rainviewer.com/public/weather-maps.json` → host + `past[]`.
- Analiza: z=5 (wyższe zoomy RainViewera często wracają puste ~334 B). Mapa **overzoomuje** ostatni dobry poziom — stąd brak „Zoom level not supported”.
- Serwer ściąga kafelki dla **bboxu Polski** (z=5, stride 2 px, do ~5000 próbek × **4 klatki**), dekoduje PNG. Cache ~90 s na `latestTime`. Pinezka nie recentruje radaru.
- `maxLevel` / `nearestKm` dla copy ETA liczy klient wokół pinezki z krajowych próbek.
- Overlay na mapie: te same URL-e RainViewer jako raster MapLibre, `maxzoom: 5`.

Klatki **nie idą do gita ani bazy**. Serwer zwraca próbki JSON. Klient trzyma ostatnie skany w Zustand (RAM). `localStorage` ma tylko miasto, promień, zgodę na powiadomienia.

## Komórki i wektory

1. **Tożsamość masy:** flood-fill / friends-of-friends po próbkach `level ≥ 1` (link ~20 km). Jedna spójna masa echa = jeden obiekt.
2. **Ruch echa:** trop centroidu masy + NCC. Mega-masa (>140 km) → **split na kafelki ~55 km** (nie wyrzucamy całego frontu). Strzałka przy pewności ≥ **72**, zgodności trop↔NCC, stabilnej liczbie próbek w tropie. Max **3** strzałki (po pewności).
3. **Kotwica na mapie:** środek masy. Długość ≈ prędkość × 30 min.
4. **Pinezka nie przebudowuje kresków.** Snapshot radaru jest wspólny dla kraju; wybór miejsca = ostrzeżenia + ETA/szansa na tych samych klatkach.
5. Prędkość z przesunięcia siatki / bazy ~30 min. Poniżej ~4 km/h = prawie stoi.
6. Rysunek na **canvasie nad MapLibre**. Kolor: atramentowy kontur + bursztyn (`#f0a202`).
7. `threat.track` = narracja pinu; `threat.tracks` = pole ruchu (może zawierać burze daleko od pinu).
8. Pinezka: ETA / trafi-minie / szansa / copy; ostrzeżenia po TERYT.

Echo ≤ ~12 km (rozdzielczość z=5) = **teraz**, nie „minie”. „Minie” tylko gdy najbliższe echo jest dalej niż 20 km i tor naprawdę omija pinezkę.

## ETA

W oknie 0–90 min, krok 2 min, rzutujemy komórkę po azymucie i prędkości.

- Najbliższe podejście ≤ 5 km → **trafi w pinezkę**. ETA = czas tego zbliżenia.
- Echo już w 5 km → ETA **teraz**.
- Zbliża się i minie ≤ 12 km → ETA z adnotacją, to jeszcze o nas.
- Minie daleko albo stoi bez kierunku → ETA `—` albo `minie`, bez udawania pewności.

Szansa % jest grubą siatką (5–95, krok 5): IMGW, odległość echa, czy tor trafia, czy komórka odchodzi. To nie model MESO-NH. UI mówi „szansa”, nie „pewność”.

## Kopiowanie komunikatu

Gdy sprawa dotyczy pinezki:

- `Idzie od zachodu → na wschód · 48 km/h`
- `Spodziewaj się: deszcz i mokrą jezdnię` (z poziomu echa, nie z jutrzejszego ostrzeżenia z słowem „grad”)
- `Dojście nad Kraków: ok. 18 min`

Gdy echo jest 127 km stąd i nie idzie na nas: **Czysto** + przycisk **Pokaż ruch opadu**, żeby zobaczyć strzałki na komórce bez kłamania, że burza jest nad miastem.

## Mapa

- OpenFreeMap Positron (jasny, bez klucza). Fallback: Esri Light Gray, jeśli styl padnie na 401.
- Klik = nowa pinezka („Punkt na mapie”), reverse geocode Nominatim.
- GPS: `navigator.geolocation` — w osadzonym podglądzie iframe jest blokowany; wtedy otwieramy wybór miasta.

## Świadome ograniczenia

- RainViewer to przetworzony POLRAD, nie surowy volume IMGW. Opóźnienie rzędu kilku–kilkunastu minut.
- z=5 ma grubą siatkę (~kilkanaście km na próbkę). Dobre do wektora mezoskali, słabe do pojedynczej komórki superkomórki.
- Dwa skany ~10 min. Nie optyczny flow. Jitter centroidu potrafi zmylić wolne, rozpadające się echo.
- Ostrzeżenie IMGW jest **powiatowe**. Łączymy je TERYT-em, ale nie udajemy, że IMGW wie, nad którą ulicą spadnie.

Szczegóły implementacji: [`src/lib/weather/`](../src/lib/weather/).
