# Weryfikacja nowcastu (hindcast)

Nowcast, którego nikt nie sprawdził, to zgadywanie. `npm run hindcast` mierzy, jak
GROM radzi sobie **na prawdziwym radarze**, tak jak robią to służby meteo:

1. Pobiera ostatnie 2 h klatek — domyślnie RainViewer (13 × 10 min); `npm run hindcast -- --sri`
   bierze IMGW COMPO_SRI (24 × 5 min, `.sri.h5`) i dekoduje je tak jak serwer.
2. Dla siatki ~170 pinezek nad Polską liczy `computeThreat` z klatek *t−30…t*.
3. Porównuje oś czasu 0–60 min i decyzję `evaluateAlert()` z tym, co radar
   **naprawdę** pokazał w klatkach *t+10…t+60*.
4. Raportuje POD / FAR / CSI dla każdego wyprzedzenia, na tle **persystencji**
   („będzie jak teraz”) — to minimum, które nowcast musi pobić.

Klatki lądują w katalogu tymczasowym systemu, nie w repo (`--cached` liczy ponownie
bez pobierania). Skrypt szanuje limit RainViewera (100 żądań/min).

`npm run --silent hindcast -- --json` drukuje ten sam przebieg jako jeden obiekt
(stdout) — oba zestawy progów alertu (shipped i research) plus tabelę kalibracji
Szansy. Wiersze z kolejnych dni burzowych: [`HINDCAST-LOG.md`](HINDCAST-LOG.md).

## Metryki

Dla zdarzenia binarnego („nad pinezką ≥ klasa X”):

| | znaczy |
|---|---|
| **POD** | *probability of detection* — ile zaobserwowanych opadów zapowiedzieliśmy |
| **FAR** | *false alarm ratio* — ile naszych zapowiedzi było na darmo |
| **CSI** | *critical success index* — trafienia / (trafienia + pudła + fałszywe); jedna liczba na „jak dobrze” |

Liczymy tylko pinezki z echem ≤ 100 km — reszta jest trywialnie sucha i zawyżałaby wynik.

## Wynik z 31 VIII 2026, 05:50–07:50 UTC (front z SW nad Dolnym Śląskiem)

Alert „sucho teraz → opad w ciągu 60 min”, tak jak strzela `evaluateAlert()`:

| Próg | Przed audytem | Po |
|---|---|---|
| ≥ klasa 1 (jakikolwiek deszcz) | POD 48 % · FAR 27 % · CSI 41 % | **POD 68 % · FAR 29 % · CSI 53 %** |
| ≥ klasa 2 (≥ 1 mm/h) | POD 33 % · FAR 41 % · CSI 27 % | **POD 64 % · FAR 32 % · CSI 49 %** |

Oś czasu vs persystencja (klasa ≥ 1): +30 min CSI 58 % vs 53 %, +60 min 55 % vs 43 %.
Błąd ETA na trafieniach: mediana +5 min (klasa 1), +10 min (klasa 2), rozrzut −20…+30 —
lekko za późno, bo ekstrapolacja liniowa nie widzi, że komórka rośnie.

## Co zmieniło wynik

- **Trafienie liczone z próbek, nie z centroidu.** Wcześniej „trafi” wymagało, by
  *środek masy* przeszedł ≤ 5 km od pinezki — front szeroki na 50 km, którego środek
  mijał 20 km obok, dostawał „minie bokiem”. Teraz decyduje adwekcja wsteczna
  rzeczywistych próbek (ta sama, co oś czasu).
- **Regionalny wektor ruchu jako fallback.** Masa bez własnego pewnego toru dawała
  persystencję. Teraz NCC (TREC) na polu wokół *najbliższego echa* — wektor jest w
  ~87 % przypadków z echem w zasięgu, zamiast ~30 %.
- **NCC na siatce 3 km z podpikselowym wierzchołkiem** (parabola) i wyszukiwaniem
  coarse-to-fine — prędkości nie skaczą co 30 km/h.
- **Promień zapytania rośnie z wyprzedzeniem** (~15 % przemieszczenia, max +6 km) —
  uczciwa niepewność pozycji; +20 pkt POD za kilka punktów FAR.
- **Alert na ETA do *progu*, nie do pierwszej kropli.** Gdy mży, a ulewa jest 20 min
  dalej, alertem jest ulewa. Wcześniej ani „nadciąga”, ani „nad Tobą” nie strzelały.
- **„Nad Tobą” = klasa progu nad pinezką (8 km)**, nie w 25 km.

## Czego hindcast nie mówi

Jeden poranek, jeden front. Skill zależy od typu pogody: fronty stratiformowe
ekstrapolują się dobrze, konwekcja popołudniowa (komórki rosną in situ) — dużo gorzej.
Uruchamiaj po każdej zmianie w `threat.ts` / `alerts.ts` i porównuj z persystencją,
najlepiej w różne dni. Gdy wejdą dane IMGW 5 min / 1 km, ta sama komenda powie, ile
to dało.
