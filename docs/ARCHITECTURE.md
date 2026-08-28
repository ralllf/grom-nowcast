# Architektura GROM

Nowcast w GROM-ie to trzy warstwy: **pobranie radaru**, **zrozumienie komórek**, **zdanie na pinezkę**.

```text
RainViewer kafelki PNG (z=5, okolica pinezki)
        │  serwer dekoduje pngjs, nie trzyma plików
        ▼
  próbki (lat, lon, level 1–4)  ×  4 skany (~30 min)
        │
        ▼
  klastry → adwekcja pola (siatka ~10 km) + trop komórki
        │  kierunek = przesunięcie całej masy, nie krawędzi przy pinezce
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
| **Horyzont tropu** | 100 km (`TRACK_MAX_KM`) | komórki dalej nie są zagrożeniem na 90 min i nie dostają strzałki |
| **Próbkowanie** | 110 km od pinezki | w tym za granicą (Zgorzelec ← Saksonia). Nie skanujemy całej Polski. |

Szansa i ETA **nigdy** nie są średnią z całego koła. Koło na mapie to tylko zasięg czujności.

## Radar

- Źródło kafelków: `https://api.rainviewer.com/public/weather-maps.json` → host + `past[]`.
- Analiza: z=5 (wyższe zoomy RainViewera często wracają puste ~334 B). Mapa **overzoomuje** ostatni dobry poziom — stąd brak „Zoom level not supported”.
- Serwer ściąga kafelki wokół pinezki (z=5, do 9 szt. × **4 klatki** ~30 min), dekoduje PNG, próbuje piksele co 4 px. Zostawia tylko echo w **110 km** — w tym za granicą. Komórka nad Lublinem nie trafia do nowcastu Zgorzelca.
- `maxLevel` dla pinezki = maksimum w 25 km, nie maksimum z całych Niemiec na tym samym kafelku.
- Overlay na mapie: te same URL-e RainViewer jako raster MapLibre, `maxzoom: 5`.

Klatki **nie idą do gita ani bazy**. Serwer zwraca próbki JSON. Klient trzyma ostatnie skany w Zustand (RAM). `localStorage` ma tylko miasto, promień, zgodę na powiadomienia.

## Komórki i wektory

1. Greedy clustering próbek `level ≥ 1`, promień klastra 48 km, min. 3 próbki — duże fronty to jedna masa, nie sześć strzałek.
2. **Kierunek pola (adwekcja):** siatka ~10 km w 80 km od pinezki. Między klatkami szukamy przesunięcia, które najlepiej nakłada echo. 4 skany ~30 min, średnia kołowa; najdłuższa baza ma większą wagę. To tor **całej masy**, nie krawędzi przy pinezce (tam centroid skacze po brzegu frontu).
3. Fallback: centroid masy w 80 km (waga = poziom echa, bez 1/d) + trop komórki wstecz (max 45 km, odrzut > 95 km/h).
4. Strzałka **stoi** na deszczu przy pinezce; azymut jest z pola. Max **dwie** strzałki.
5. Prędkość z przesunięcia siatki / bazy 30 min. Poniżej ~4 km/h = prawie stoi.
6. Rysunek na **canvasie nad MapLibre**. Kolor: atramentowy kontur + bursztyn (`#f0a202`).

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
