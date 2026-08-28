# Architektura GROM

Nowcast w GROM-ie to trzy warstwy: **pobranie radaru**, **zrozumienie komórek**, **zdanie na pinezkę**.

```text
RainViewer kafelki PNG (z=5, Polska)
        │  serwer dekoduje pngjs, nie trzyma plików
        ▼
  próbki (lat, lon, level 1–4)  ×  dwa kolejne skany (~10 min)
        │
        ▼
  klastry → komórki → dopasowanie prev→now → wektor (bearing, km/h)
        │
        ▼
  projekcja 90 min względem pinezki (5 km)
        │
        ├── ETA / szansa % / „idzie od… spodziewaj się…”
        └── canvas na mapie: strzałka ze środka komórki
```

## Pinezka vs promień

| Pojęcie | Dystans | Po co |
|---|---|---|
| **Pinezka** | 5 km (`PIN_KM`) | miasto z listy, punkt z mapy, później dokładny GPS |
| **Lokalny max** | 25 km | „czy nad Tobą jest już echo” |
| **Promień alertu** | 15–80 km, suwak | jak daleko wołamy „opad w okolicy” |
| **Skan Polski** | bbox ~48.9–54.9 N, 14.1–24.2 E | wektory na komórkach w kraju, nie nad Bałtykiem / Niemcami |

Szansa i ETA **nigdy** nie są średnią z całego koła. Koło na mapie to tylko zasięg czujności.

## Radar

- Źródło kafelków: `https://api.rainviewer.com/public/weather-maps.json` → host + `past[]`.
- Analiza: z=5 (wyższe zoomy RainViewera często wracają puste ~334 B). Mapa **overzoomuje** ostatni dobry poziom — stąd brak „Zoom level not supported”.
- Serwer ściąga do 9 kafelków × 2 klatki (aktualna + poprzednia), dekoduje PNG, próbuje piksele co 6 px, odrzuca tło.
- `maxLevel` dla pinezki = maksimum w 25 km, nie maksimum z całych Niemiec na tym samym kafelku.
- Overlay na mapie: te same URL-e RainViewer jako raster MapLibre, `maxzoom: 5`.

Klatki **nie idą do gita ani bazy**. Serwer zwraca próbki JSON. Klient trzyma ostatnie skany w Zustand (RAM). `localStorage` ma tylko miasto, promień, zgodę na powiadomienia.

## Komórki i wektory

1. Greedy clustering próbek `level ≥ 1`, promień klastra 32 km, min. 3 próbki.
2. Każdą komórkę „teraz” łączymy z najbliższą komórką z poprzedniego skanu (max 45 km).
3. Prędkość ze środka do środka. Powyżej 95 km/h = zły match, odrzucamy. Poniżej ~4 km/h = prawie stoi (kierunek niepewny).
4. Strzałka: 10 km wstecz przez środek, do przodu `max(0.5 × prędkość, 36 km)` — ma być **czytelna na mapie**, nie mikroskopijna.
5. Rysunek jest na **canvasie nad MapLibre**, nie w GeoJSON pod kafelkami radaru. Kolor: atramentowy kontur + bursztyn (`#f0a202`), żeby było widać i na jasnym Positronie, i na zielono-czerwonym radarze.

Do 6 wektorów, bliższe pinezce i te „grożące” na wierzchu.

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
