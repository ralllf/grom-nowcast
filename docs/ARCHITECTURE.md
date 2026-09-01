# Architektura GROM

Nowcast w GROM-ie to trzy warstwy: **pobranie radaru**, **zrozumienie komórek**, **zdanie na pinezkę**.

```text
IMGW COMPO_SRI .sri.h5 (datastore, 5 min)  ──outage──▶  RainViewer kafelki (fallback)
        │  h5wasm + odwrotne aeqd; overlay = 1 PNG / klatkę (4 klasy)
        ▼
  próbki (lat, lon, level 1–4)  ×  4 skany (SRI: 15–20 min; fallback: ~30 min)
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

- **Analiza: IMGW COMPO_SRI** z datastore (listing POST `getFilesList`, plik `.sri.h5`). 800×800, ~1.16 km, aeqd, `quantity=RATE` w mm/h, kadencja 5 min. RainViewer zostaje automatycznym fallbackiem analizy i overlayu, gdy listing/H5 padnie.
- **Fallback kafelków:** `https://api.rainviewer.com/public/weather-maps.json` → host + `past[]` (13 klatek co 10 min). Pole `nowcast[]` RainViewer **wyłączył 1 I 2026** — jest puste; ekstrapolacja jest nasza.
- **Kolor → dBZ → mm/h (tylko fallback).** Kafelki `…/2/0_0.png` (Universal Blue, `smooth=0`, `snow=0`), więc każdy piksel ma dokładny kolor z tabeli RainViewera ([`palette.ts`](../src/lib/weather/palette.ts)). Kolor → dBZ (tabela), dBZ → mm/h (Marshall–Palmer `Z = 200·R^1.6`), mm/h → klasa. SRI pomija ten krok — IMGW już policzył Z–R.

  | Klasa | mm/h | dBZ | Kolor |
  |---|---|---|---|
  | 1 słaby | 0.1–1 | 15–23 | jasny błękit |
  | 2 umiarkowany | 1–4 | 24–32 | granat |
  | 3 silny | 4–10 | 33–39 | żółty |
  | 4 ulewny | ≥ 10 | ≥ 40 | pomarańcz / czerwień / róż; ≥ 55 dBZ ≈ grad |

  Beżowe, półprzezroczyste < 15 dBZ (mżawka / szum) = brak echa. Dawna heurystyka po odcieniu liczyła ten szum jako „deszcz”, a pomarańcz (40–44 dBZ) klasyfikowała *niżej* niż żółty — stąd fałszywe „opad w okolicy” i przegapione ulewy.
- **Zoom 6** (RainViewer dopuszcza ≤ 7): ~1.5 km/px na szerokości Polski, stride 2 → próbka co ~3 km. Polska = 9 kafelków na klatkę.
- **Siatka zamiast obcinania.** Piksele agregujemy do siatki ~3 km (max mm/h w komórce). Gdy próbek > 9000, siatka rośnie ×2 — pokrycie zostaje równomierne. Wcześniej próbki sortowano po poziomie i szerokości i ucinano do 5000, co przy rozległym opadzie **wyrzucało południe kraju**.
- **Cache per klatka.** Klatka SRI / RainViewera jest niezmienna → dekodujemy ją raz (cache 12 klatek). Snapshot ma dodatkowo cache 90 s. Listing SRI cache 45 s.
- **Format przesyłu.** TanStack Start opakowuje każdą liczbę w JSON (`{"t":0,"s":51.149}`), więc klatka jedzie jako **jeden string base64, 8 bajtów/próbka** ([`pack.ts`](../src/lib/weather/pack.ts)): u16 lat, u16 lon (tysięczne stopnia od rogu bboxu), u16 klasa, u16 mm/h×10. Deszczowy dzień: ~180 kB za 4 klatki zamiast ~2 MB.
- Overlay na mapie: jedno PNG 800×800 z tego samego pola SRI, pokolorowane 4 klasami legendy, źródło `image` MapLibre z narożnikami aeqd. Domyślnie klasa ≥ 1 (jak liczby); „Pokaż mżawkę” jest wyłączona. RainViewer `…/2/1_0.png` zostaje fallbackiem.

Klatki **nie idą do gita ani bazy**. Klient trzyma ostatnie skany w Zustand (RAM). `localStorage` ma tylko miasto, promień, ustawienia alertów.

## Komórki i wektory

1. **Tożsamość masy:** flood-fill / friends-of-friends po próbkach `level ≥ 1` (link ~20 km). Jedna spójna masa echa = jeden obiekt.
2. **Ruch echa:** trop centroidu masy + NCC. Mega-masa (>140 km) → **split na kafelki ~55 km** (nie wyrzucamy całego frontu). Strzałka przy pewności ≥ **72**, zgodności trop↔NCC, stabilnej liczbie próbek w tropie. Max **3** strzałki (po pewności).
3. **Kotwica na mapie:** środek masy. Długość ≈ prędkość × 30 min.
4. **Pinezka nie przebudowuje kresków.** Snapshot radaru jest wspólny dla kraju; wybór miejsca = ostrzeżenia + ETA/szansa na tych samych klatkach.
5. Prędkość z przesunięcia siatki / bazy ~30 min. Poniżej ~4 km/h = prawie stoi.
6. Rysunek na **canvasie nad MapLibre**. Kolor: atramentowy kontur + bursztyn (`#f0a202`).
7. `threat.track` = narracja pinu; `threat.tracks` = pole ruchu (może zawierać burze daleko od pinu).
8. Pinezka: ETA / trafi-minie / szansa / copy; ostrzeżenia po TERYT.

Echo ≤ 8 km (`OVER_KM`, siatka ~3 km) = **teraz**, nie „minie”. „Minie” tylko gdy najbliższe echo jest dalej niż 20 km i tor naprawdę omija pinezkę.

**Nad Tobą znaczy nad Tobą.** `pinLevel` = najsilniejsze echo w 8 km od pinezki; `maxLevel` (25 km) to kontekst dla mapy. Tytuł „nad Tobą” / „nadciąga” nazywa intensywność nad pinezką (*Deszcz* / *Ulewa* / *Burza* = klasa 4), a nie najczerwieńszy piksel w powiecie. Dawniej rdzeń 20 km obok plus mżawka nad miastem dawały „Burza nad Tobą”.

## ETA

W oknie 0–90 min, krok 2 min, rzutujemy komórkę po azymucie i prędkości.

- Najbliższe podejście ≤ 5 km → **trafi w pinezkę**. ETA = czas tego zbliżenia.
- Echo już w 5 km → ETA **teraz**.
- Zbliża się i minie ≤ 12 km → ETA z adnotacją, to jeszcze o nas.
- Minie daleko albo stoi bez kierunku → ETA `—` albo `minie`, bez udawania pewności.

Szansa % jest grubą siatką (5–95), potem **przemapowana** na częstość z dziennika
hindcastu ([`chance.ts`](../src/lib/weather/chance.ts), Slice 8): surowy szczebel
60 (tor trafia) → 55, 70/80 (nad pinezką / ETA ≤ 20) → 90, 55 (echo w 20 km) → 20.
Tylko gdy echo jest ≤ 100 km — suche pinezki i samo IMGW zostają na surowym
szczeblu. To nie model MESO-NH. UI mówi „szansa”, nie „pewność”.

## Trafi czy minie — z próbek, nie z centroidu

Wektor ruchu dla pinezki: tor własnej masy (trop centroidu + NCC), a gdy go nie ma —
**regionalny NCC** na polu wokół *najbliższego echa* (`REGIONAL_CONFIDENCE_MIN`). NCC liczy
się na siatce **3 km** (jak próbki) z podpikselowym wierzchołkiem (parabola) i wyszukiwaniem
coarse-to-fine. `willHit`, `etaMin` i „minie” wynikają z **adwekcji rzeczywistych próbek**
nad pinezkę — nie z tego, czy *środek masy* przejdzie 5 km od pinezki. Front szeroki na
50 km ze środkiem 20 km obok **trafia**. Promień zapytania rośnie z wyprzedzeniem
(~15 % przemieszczenia, max +6 km). Alert liczy ETA **do progu intensywności**
(`etaToLevel`), więc mżawka nie maskuje ulewy. Liczby: [`docs/HINDCAST.md`](HINDCAST.md).

## Oś czasu opadu (jak MeteoSwiss)

Pod statystykami jest pasek **0–90 min co 5 min**: ile mm/h będzie nad pinezką. Liczymy przez **adwekcję wsteczną**: powietrze, które za *t* minut będzie nad pinezką, jest teraz w punkcie `pinezka − v·t` (wektor z toru głównej masy). Bierzemy max mm/h w promieniu ~6 km od tego punktu. Bez wiarygodnego ruchu — persystencja („bez ruchu — jak teraz”), oznaczona w UI. To ekstrapolacja liniowa: bez wzrostu/zaniku komórek, bez modelu NWP. MeteoSwiss (INCA/NowPrecip) robi to samo na 1 km i dokleja model po ~1–2 h — tu tego nie ma.

## Kopiowanie komunikatu

Gdy sprawa dotyczy pinezki:

- `Idzie od zachodu → na wschód · 48 km/h`
- `Spodziewaj się: deszcz i mokrą jezdnię` (z poziomu echa, nie z jutrzejszego ostrzeżenia z słowem „grad”)
- `Komórka rośnie` / `Komórka słabnie` — trend intensywności/powierzchni tej samej masy na 4-klatkowym tropie (`buildMassTrail`). **Tylko copy:** bramka Slice 0 nie przepuszcza korekty osi czasu / ETA (za mało dni konwekcyjnych w [`HINDCAST-LOG.md`](HINDCAST-LOG.md)).
- `Dojście nad Kraków: ok. 18 min`

Gdy echo jest 127 km stąd i nie idzie na nas: **Czysto** + przycisk **Pokaż ruch opadu**, żeby zobaczyć strzałki na komórce bez kłamania, że burza jest nad miastem.

## Alerty (w karcie)

Alert to nie „poziom zagrożenia co 90 s”. To **epizod burzy** i maksymalnie trzy zdania na epizod:

```text
idle ──nadciąga──▶ incoming ──nad Tobą──▶ now ──przeszło──▶ idle
  └──────nad Tobą────────────────────────────┘
```

| Etap | Warunek (z `Threat`) | Copy |
|---|---|---|
| **nadciąga** | `willHit`, `!receding`, `0 < etaMin ≤ leadMin`, `cellLevel ≥ minLevel`, `chancePct ≥ minChancePct` | `Deszcz za ok. 18 min` · *Idzie od zachodu (~40 km/h) na Kraków. Szansa ~70%.* |
| **nad Tobą** | `etaMin === 0`, echo ≤ 12 km, `maxLevel ≥ minLevel` | `Ulewa i wiatr nad Kraków` |
| **przeszło** | echo > 20 km (albo odchodzi i > 12 km) przez ≥ 3 min | `Przeszło · Kraków` — *odszedł na wschód* / *minął bokiem* |

Zasady:

- **Jeden alert na etap epizodu.** Front, który wisi 3 godziny, nie woła co godzinę. Nowa komórka po ciszy (epizod zamknięty przez „przeszło” albo wygasły po 45 min bez kwalifikacji) — woła znowu.
- **Radar starszy niż 30 min nie woła.** Awaria RainViewera to nie prognoza.
- **Zmiana pinezki = nowy epizod.** Pamięć epizodu jest w `localStorage` (`grom-alert-memory-v1`) tylko dla tej samej pinezki i tylko póki świeża — reload w środku burzy nie powtarza „nad Tobą”.
- Silnik jest czysty: `evaluateAlert(threat, settings, memory, now)` w [`src/lib/weather/alerts.ts`](../src/lib/weather/alerts.ts), testy w `alerts.test.ts`. Dostarczanie (Notification API, dźwięk Web Audio, miganie tytułu karty, baner) w [`src/lib/alert-delivery.ts`](../src/lib/alert-delivery.ts).
- **Ciche godziny**: zostaje baner w aplikacji; bez dźwięku i bez powiadomienia systemowego.
- Zgoda na powiadomienia systemowe **nie jest wymagana** — baner działa zawsze. Bez zgody nie ma dźwięku w tle.
- Karta w tle nadal odpytuje radar (`refetchIntervalInBackground`), przeglądarki dławią timery do ~1/min — wystarcza. Karta **zamknięta** = brak alertów. Push w tle (VAPID + service worker + harmonogram po stronie serwera) to osobny krok.

Ustawienia: presety **Czuły / Normalny / Tylko pewne** wiążą `leadMin`, `minLevel`,
`minChancePct`. Surowy `leadMin` 10–60, `minLevel` 1–3 (słaby deszcz / deszcz /
ulewa-burza) i `minChancePct` zostają pod **zaawansowane**. Do tego `quietFrom/To`,
`sound`, `allClear`. Klucz `grom-settings-v1.alerts`; stare `notify: true` migruje
na `enabled`. Normalny = wysłane defaulty (30 / 2 / 50).

## Mapa

- OpenFreeMap Positron (jasny, bez klucza). Fallback: Esri Light Gray, jeśli styl padnie na 401.
- Klik = nowa pinezka („Punkt na mapie”), reverse geocode Nominatim.
- GPS: `navigator.geolocation` — w osadzonym podglądzie iframe jest blokowany; wtedy otwieramy wybór miasta.

## Świadome ograniczenia

- Analiza SRI to kompozyt IMGW (10 radarów, co 5 min, ~1.16 km, 800×800). Overlay mapy to to samo pole w 4 klasach legendy (F9). RainViewer zostaje fallbackiem. Opóźnienie SRI rzędu kilku minut. Szczegóły siatki: `docs/DATA.md`.
- Siatka ~3 km. Dobra do wektora mezoskali i do „czy pada nad miastem”; pojedyncza komórka < 3 km może zniknąć między próbkami.
- Marshall–Palmer to jedna relacja Z–R dla wszystkiego: w burzy konwekcyjnej zaniża, w mżawce zawyża. Klasy mm/h są orientacyjne.
- Cztery skany ~30 min, ekstrapolacja liniowa. Nie optyczny flow, bez wzrostu/zaniku komórek.
- Ostrzeżenie IMGW jest **powiatowe**. Łączymy je TERYT-em, ale nie udajemy, że IMGW wie, nad którą ulicą spadnie.

Szczegóły implementacji: [`src/lib/weather/`](../src/lib/weather/).
