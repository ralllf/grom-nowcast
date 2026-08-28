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

Szczegóły implementacji: [`src/lib/weather/`](../src/lib/weather/).
