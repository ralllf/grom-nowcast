# GROM

**Nowcast burzowy dla Polski.** Alert na minuty, nie na powiat.

GROM mówi, *skąd idzie opad*, *kiedy dojdzie nad Twoją pinezkę* i *czego się spodziewać* — z radaru na żywo i ostrzeżeń IMGW. Nie z komunikatu „burze w województwie”.

> Komórka może urosnąć na miejscu. Tego radar nie zapowie — i GROM tego nie ukrywa.

![GROM](public/favicon.svg)

## Po co

IMGW i RCB ostrzegają **powiatami z wyprzedzeniem godzin**. To za mało, gdy stoimy pod chmurą i chcemy wiedzieć: *czy ta komórka idzie na mnie, za ile minut, i czy to mżawka czy ulewa.*

GROM jest bliżej **MeteoSwiss / RainViewer nowcast** niż klasycznej prognozy:

| | Ostrzeżenie powiatowe | GROM |
|---|---|---|
| Skala | powiat / województwo | pinezka (~5 km) — miasto albo GPS |
| Czas | godziny | minuty (okno ~90 min) |
| Ruch | brak | wektor ze środka komórki |
| Komunikat | „możliwe burze” | „idzie od zachodu, ulewa, ETA 18 min” |

## Co umie MVP

- Mapa radarowa (RainViewer, kompozyt POLRAD) na jasnym podkładzie OpenFreeMap — **bez klucza API**.
- Intensywność w **mm/h** z dokładnej tabeli kolorów RainViewera (dBZ → Marshall–Palmer), cztery klasy jak w legendzie MeteoSwiss: słaby / umiarkowany / silny / ulewny. Siatka ~3 km (zoom 6).
- **Oś czasu opadu nad pinezką** 0–90 min co 5 min (adwekcja wsteczna z ruchu echa) — jak pasek „Niederschlag” w aplikacji MeteoSwiss.
- Wektory ruchu: pomarańczowa strzałka wychodzi ze **środka komórki** w kierunku przesuwania się opadu.
- **Szansa %** i **ETA** liczone dla pinezki, nie dla promienia alertu.
- Tekst: *Idzie od… → na…* oraz *Spodziewaj się: …*
- Ostrzeżenia IMGW dopasowane TERYT-em do wybranego miasta.
- **Alerty na pinezkę** (karta otwarta, może być w tle): „nadciąga” gdy tor trafia w pinezkę i dojście ≤ N min, „nad Tobą”, „przeszło”. Jeden alert na etap burzy, próg intensywności, ciche godziny, dźwięk, baner + powiadomienie systemowe.
- Miasta PL z listy, wyszukiwarka Nominatim, klik na mapie. GPS na telefonie (w iframe podglądu przeglądarka go blokuje).
- Klatki radaru **tylko w RAM** (ostatnie skany). Ustawienia w `localStorage`. **Żadnych plików radarowych w git.**

## Nazwa

**GROM** — krótko, po polsku, od razu wiadomo że o burzy. Tagline: *na Twoją pinezkę, nie na cały powiat.*

Repo: `grom-nowcast`.

## Stack

TanStack Start + React 19 + Vite, MapLibre GL, Zustand, TanStack Query, `pngjs` (dekodowanie kafelków radaru po stronie serwera), Zod.

Źródła: [RainViewer](https://www.rainviewer.com/), [IMGW-PIB](https://danepubliczne.imgw.pl/), Nominatim/OSM, OpenFreeMap.

## Dokumentacja

- [Architektura nowcastu](docs/ARCHITECTURE.md) — radar, komórki, ETA, pinezka vs promień, alerty
- [Źródła danych i licencje](docs/DATA.md) — IMGW, RainViewer, co wolno, czego nie trzymamy
- [Weryfikacja nowcastu](docs/HINDCAST.md) — `npm run hindcast`: POD / FAR / CSI na prawdziwym radarze vs persystencja
- [Pomysły i roadmapa](docs/IDEAS.md) — GPS, push, POLRAD, pioruny, tożsamość produktu
- [Plan dokładności i niezawodności](docs/ACCURACY-PLAN.md) — ranking błędów, źródła danych (SRI, PERUN), warstwy, taksonomia alertów, kolejność małych kroków

## Uruchomienie

```bash
npm install
npm run dev
```

Aplikacja nasłuchuje na `0.0.0.0:8080`.

```bash
npm run typecheck
npm test
```

Nie potrzebujesz klucza MapTiler / Google. Radar i mapa idą z publicznych kafelków.

## Zasady, których nie łamiemy

1. **Pinezka, nie powiat.** Szansa, ETA i strzałka są dla miasta / GPS. Promień w ustawieniach to tylko zasięg „wołania” alertu.
2. **Radar nie wróżki.** Nowcast to ekstrapolacja echa. Komórka może powstać lokalnie przy czystym radarze — UI o tym mówi.
3. **Nie commitujemy klatek radaru.** Skan żyje w pamięci procesu / przeglądarki.
4. **To nie jest oficjalny alert RCB.** Źródłem ostrzeżeń i sieci POLRAD jest IMGW-PIB. Dane radarowe są przetworzone.

## Autor

Rafał Strzelczyk · [github.com/ralllf](https://github.com/ralllf)

MIT — zobacz [LICENSE](LICENSE). Atrybucja danych: [docs/DATA.md](docs/DATA.md).
