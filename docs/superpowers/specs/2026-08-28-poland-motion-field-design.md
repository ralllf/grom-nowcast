# Poland motion field (pin-free arrows)

**Goal:** Strzałki ruchu opadu są polem pogodowym dla Polski: liczone przy aktualizacji radaru, niezależne od pinezki. Pinezka = ostrzeżenia IMGW (+ ETA/szansa z tego samego pola).

## Decisions

1. **Domena:** bbox Polski + margines graniczny (~48.8–55.2°N, 13.8–24.6°E). Nie koło od pinu, nie cały świat.
2. **Próbkowanie:** RainViewer z=5 po kafelkach bboxu; cache krajowy na `latestTime` (współdzielony między requestami).
3. **Tracki:** masy z connectivity + NCC jak dziś; ranking po sile; **zero pinu** w wyborze / stylu strzałek. `MAX_TRACKS` podniesione pod kraj (np. 6).
4. **Długość:** geo-długość „do przodu” ≈ prędkość × horyzont (np. 30 min). Bez sztucznego min. px spłaszczającego różnice.
5. **Klient:** `queryKey` snapshotu nie zależy od pinu. Pin zmienia ostrzeżenia / copy ETA na tych samych klatkach.
6. **Poza zakresem:** filtrowanie po viewportcie mapy (później); ETA zostaje.

## Success

- Klik w różne miejsca w PL → te same kotwice i bearingi strzałek (dopóki te same klatki).
- Nowa klatka radaru (~90 s) → nowe strzałki.
- Szybsza komórka = wyraźnie dłuższa kreska niż wolna.
