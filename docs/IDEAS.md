# Pomysły na GROM

Dokument zrodzony z pierwszej rozmowy: *chcę coś jak MeteoSwiss, ale dla Polski, na minuty, na moją lokalizację — nie powiat z wyprzedzeniem.*

To nie backlog ticketów. To kierunek produktu. MVP już dowodzi, że wektor + ETA na pinezkę da się zrobić z publicznych kafelków.

## Produkt, nie „jeszcze jedna mapa radaru”

Polska ma RainViewer, Ventusky, Windy, IMGW. GROM wygrywa tylko jeśli:

1. **Mówi ludzkim zdaniem** — skąd, za ile, czego się spodziewać.
2. **Liczy do pinezki** — balkon, boisko, autostrada, nie „małopolskie”.
3. **Nie kłamie pewnością** — komórka potrafi urosnąć w miejscu.

Wszystko poniżej ma to wzmacniać albo odpaść.

## Ścieżka GPS

MVP: miasto / klik. Cel: ten sam kod pinezki na `geolocation` w PWA na telefonie.

- Watch position, nie jednorazowy fix (autostrada).
- Background: na webcie prawie nie istnieje. Docelowo: PWA + ewentualnie native wrapper.
- W iframe (podglądy, osadzenia) GPS bywa zablokowany — zostaje wybór miasta. To feature, nie bug.

## Alerty, które nie krzyczą bez potrzeby

- Browser Notification gdy `imminent` / `now` i karta otwarta — jest szkic.
- Web Push w tle: VAPID, zgoda, ciche godziny, próg szansy.
- Nie dublować RCB. GROM woła *minuty przed echem nad pinezką*, RCB woła *zagrożenie w powiecie*.
- Tryb „tylko gdy tor trafia we mnie”, nie „cokolwiek w 80 km”.

## Lepszy nowcast

- **RainViewer nowcast frames** (gdy API je oddaje) zamiast samej ekstrapolacji dwóch skanów past.
- Trzy–cztery klatki i medianowy wektor, mniej jitteru centroidu.
- Optyczny flow na siatce zamiast nearest-cell (wolne, rozpadające się echo).
- Osobny wektor dla rdzenia `level ≥ 3` i osobny dla stratiformu.
- Hail / echo top — dziś zgadujemy z koloru i tekstu IMGW. Surowy POLRAD volume dałby więcej, ale to inna umowa z IMGW.

## Lepsze dane

- Oficjalny dostęp do POLRAD / danepubliczne wyższej rozdzielczości niż z=5.
- Detekcja wyładowań (Blitzortung / IMGW) jako potwierdzenie „to burza, nie tylko deszcz”.
- Model UM/COAMPS tylko jako tło 6–12 h, nigdy zamiast radaru w oknie 90 min.
- Satelit (EUMETSAT) na noc i w górach, gdzie radar ślepie.

## Precyzja miejsca

- Pinezka 5 km jest uczciwa przy z=5. Przy lepszym radarze: 2 km, potem dach budynku.
- Trasa: „czy komórka przetnie A4 między Gliwicami a Krakowem w ciągu 40 min”.
- Kilka pinezek (dom, szkoła, działka) bez konta — lokalna lista.

## Komunikacja

- Dwa zdania max na ekranie telefonu. Reszta pod złożeniem.
- Głos / skrót na lock screen: „Ulewa od zachodu, 12 min”.
- Język: polski na start. Śląski humor nie. IMGW-owy bełkot też nie.
- Tryb „wyjście z domu”: jeden ekran, jedna decyzja (weź kurtkę / zostań / jedź).

## Tożsamość wizualna

- Ciemny panel, jasna mapa, bursztynowy wektor — zostawiamy.
- Nie udawać natywnej apki IMGW (niebieski urzędowy).
- Ikona pioruna już jest (`favicon.svg`). Można dociągnąć wordmark GROM.
- Zero kluczy map w onboarding. To była pierwsza rana zaufania („API KEY REQUIRED”) — nigdy więcej.

## Dystrybucja

- PWA (Add to Home Screen) zanim cokolwiek w App Store.
- Deep link `?lat=&lon=` na mecz / festiwal.
- Widget? Na webcie słaby. Na iOS — późniejsza natywna skorupa.

## Czego świadomie nie robimy (na razie)

- Kont, logowania, chmury lokalizacji — nie potrzeba, żeby nowcast działał.
- Zapisu klatek radaru „na później / na ML” w tym repo.
- Prognozy 7-dniowej. To inna apka.
- Czarnej mapy kosztem czytelności ulic.
- Udawania, że 10% szansy przy czystym radarze to zero. Formowanie in situ zostaje w copy.

## Kolejność, jeśli wracamy do kodu

1. GPS na prawdziwym telefonie, ta sama pinezka.
2. Push tylko dla toru, który *trafia*.
3. RainViewer nowcast frames, gdy wrócą w API.
4. Wyładowania jako znacznik „to burza”.
5. Trasa / kilka pinezek.

Dopóki (1) i komunikat *skąd / za ile / czego się spodziewać* trzymają jakość — GROM jest sobą.
