# GROM — UI/UX & visual design review

Reviewed main @ ec7d59a and the live site on 2026-09-01 ~20:35 CEST (storm over Warsaw). Sources: the four supplied screenshots plus four I took with Playwright at 390×844 in `/Users/rafs/praca/grom-nowcast/.playwright-mcp/`: `design-mobile-live-peek.png` (loading), `design-mobile-expanded.png` (auto-expanded), `design-mobile-peek.png` (collapsed), `design-mobile-settings.png`. Pixel/contrast numbers were measured on the live DOM.

## Scores

| Area | Score | Why |
|---|---|---|
| Identity | 7 | Dark panel / light map / Sora + Plex Mono is distinctive; the "amber" vector is vermilion and collides with the red rain class. |
| Hierarchy | 5 | Peek state is right; auto-expand at `now` buries pin and echo under a 70dvh sheet. |
| Clarity | 5 | Headline is great; the same fact is then stated three times, followed by eight lines of caveats. |
| Map usability | 5 | Honest pixels, but no zoom/legend/attribution, 16px "pokaż" target, arrow covers the pin. |
| Accessibility | 4 | Faint text 2.7–3.0:1, non-modal dialog, 15 of 20 buttons lack focus rings, mute timeline. |
| Copy | 6 | Warm and honest; declension bugs in the hero line, English `NOW` badge, TERYT/dBZ leaking. |

## 1. Visual identity

**Vector colour.** IDEAS.md promises a "bursztynowy wektor", but `--color-vector` is `#e4572e` (`src/styles.css:18`) and `radar-map.tsx:66-67` uses it for hot tracks, keeping `#f0a202` for cold ones. On `grom-desktop.png` the Warsaw arrow and the L4 rain pixels (`#e62800`, `LEVEL_SWATCH` in `palette.ts`) are the same hue at 3.1:1 vs 3.8:1 on the map. Red should mean intensity; the track needs a non-precipitation hue. Use amber `#f0a202` with the existing ink outline for all tracks; hot = thicker + arrowhead.

**Radar classes on Positron** (`#e8edf2`): L2 navy 6.2:1 and L4 red 3.8:1 read well; L1 `#36bae5` is 1.9:1 and L3 `#ffc500` is 1.35:1, so the yellow near Grójec on `grom-desktop.png` nearly vanishes, and `raster-opacity: 0.78` (`radar-map.tsx:513`) makes it worse. Darken L3 to gold `#e8b400` and raise opacity to 0.85. Legend chips, timeline bars and the map all read `LEVEL_SWATCH`, so they stay consistent. Colour-blind: the ramp is luminance-ordered (light, dark, bright, dark-red), so deutan/protan users still get four steps; the real confusion is arrow vs L4 for everyone.

**Typography.** Sora 400/500/600 plus IBM Plex Mono for numbers; Sora 700 is loaded in `__root.tsx` and never used. The scale is ad hoc (10, 11, 12, 14, 20, 24, 30 px, with `text-[10px]`/`text-[11px]` literals at `threat-sheet.tsx:215,244,315,331`). Mono is used for ETA/chance (good) but also TERYT, captions and ticks, which dilutes the "instrument" voice. Reserve mono for live numbers and clocks.

**Spacing / icons.** Radii and Lucide icons are consistent. The 130×62px wordmark tile earns nothing after first launch; a 36px bolt + "GROM" frees the top-left for chips. Verdict: not an IMGW clone, not a RainViewer skin. Fix the vector hue and the yellow and it is distinctive.

## 2. First load and hierarchy on a phone

**First 3 s** (`grom-mobile-initial.png`): wordmark, two round buttons, light map, tiny teal dot, and a 96px strip "Skanuję radar… / Warszawa / SZANSA — · ETA — · ECHO brak". Acceptable except that **"Echo brak" while loading reads as an all-clear** (`threat-sheet.tsx:95` falls through to `"brak"` when `threat` is null). Show "—" until a threat exists.

**At level `now`/`imminent`** the sheet auto-expands to `max-h-[70dvh]` (`threat-sheet.tsx:106-113,147`). On `grom-mobile-loaded.png` and `design-mobile-expanded.png` the map keeps only Pułtusk–Serock; pin, arrow and echo are hidden. The user gets the answer but loses the *why*. The peek state (`design-mobile-peek.png`) already shows headline, place and trio with pin and arrow visible: that is the better default.

**Fix.** Three detents: **peek** (~128px: headline, place, Za ile / Szansa, 90-min strip), **half** (~45dvh: adds "Idzie od…", caveat, status row), **full**. Auto-expand goes to half. On expand, `fitBounds` on pin + threatening track with `padding.bottom = sheetPx + 24` (the `focus` effect at `radar-map.tsx:333-349` already does this with `padding: 90`). The `easeTo` on place change (`radar-map.tsx:294`) should offset the centre up by half the sheet.

**Trust note.** On `design-mobile-peek.png` the headline says "Ulewa nad Tobą" while the map shows the echo 40 km south and the arrow already east of Warsaw. Whatever the cause (algo team), the design should never assert "nad Tobą" without something visibly overhead; a sample-level "2 km" hit needs a visible pixel or a softer "przy Tobie".

## 3. Threat sheet content

Order today (`design-mobile-expanded.png`): `TERYT 1465` row → H2 → box "Idzie od / Spodziewaj się / Komórka słabnie" → grey paragraph → trio → radar caption → "Wyładowania chwilowo niedostępne" (amber) → timeline → pinezka disclaimer → "Ostrzeżenia IMGW chwilowo niedostępne" (amber) → five-line attribution.

- **Redundancy.** `threat.ts:1066` builds `detail` from the same `expect` and trend fields the box prints, so "Spodziewaj się: ulewę i porywisty wiatr" and "Komórka słabnie" appear twice within 60px, and "Ulewa" a third time. The box *is* the two sentences; `detail` should carry only what the box does not (in-situ caveat, miss distance, "to ruch echa").
- **Trio.** Keep two. "ETA" is an English acronym; "Echo 2 km · silny" is jargon that duplicates the first timeline bar. Use **Za ile** and **Szansa**; fold distance into the "Idzie od" line.
- **90-min bar.** Ticks read "teraz 24 54 84 min" because `wallClockAxisLabel` shifts by radar age; print clock times (20:36 · 21:00 · 21:30 · 22:00) and a now-cursor. "z ruchu echa / bez ruchu — jak teraz" is internal state; drop or caption "z ruchu radaru". Bars have only `title` tooltips (`threat-sheet.tsx:337`), which never fire on touch. Legend is 10px faint on surface-2 (2.7:1).
- **Two amber notices** look like weather warnings in a storm app. Collapse into one grey status row: `Radar 20:30 · 6 min · IMGW ✕ · wyładowania ✕`; amber only when the radar itself is stale or down.
- **Attribution** (`threat-sheet.tsx:289-297`): POLRAD, SRI, dBZ, Marshall–Palmer, COMPO_SRI go to an "O danych" details. Keep one visible line "Dane: IMGW-PIB · mapa OpenFreeMap/OSM"; today it is hidden whenever the sheet is collapsed.

**Above-the-fold spec (phone).** 1) `Ulewa nad Tobą` · `Warszawa` · Polish level chip (TERAZ / ZARAZ / BLISKO / CZYSTO). 2) `Od zachodu, 41 km/h · słabnie.` 3) `Spodziewaj się ulewy i porywistego wiatru.` 4) `Za ile: teraz · Szansa: 95%`. 5) 90-min strip. Below the fold: one caveat sentence, IMGW lane, status row, `O danych ›`.

## 4. Map layer

- **Pixels.** `raster-resampling: "nearest"` (`radar-map.tsx:497,513`) gives ~12px blocks at zoom 8.2. Honest about 3 km, but users read shape, not cells (MeteoSwiss smooths). Use `linear` below zoom 9, `nearest` above.
- **Arrow** paints on a canvas above the map (`radar-map.tsx:355`), over the pin and the "Warsaw" label (`design-mobile-peek.png`). Draw the pin last; make the past segment a dashed 2px line; keep the ink outline for the future segment only.
- **Pin**: 6px dot, teal stroke, 18% halo (`radar-map.tsx:213-234`), the smallest object on screen. Use a 10px accent fill, 3px white ring, 24px halo; tint the halo danger at `now`.
- **Slider**: top-centre pill with a radar icon, 4 frames, no play, no start/end labels, no focus style (`outline: none`). It looks like a volume control. Move it into the peek strip as a labelled scrubber with ▶. In my keyboard test the thumb moved to frame 2 but the clock stayed 20:30; verify.
- **Chips**: "pokaż" is a 36×16px inline button; "Pokaż mżawkę" is 28px tall. Make chips 36px and whole-chip tappable.
- **Missing**: zoom ±, on-map locate (the header crosshair is 40mm from the thumb), legend (4 swatches + track glyph + IMGW tint), scale bar, attribution (`attributionControl: false`, `radar-map.tsx:189`). Stack them bottom-right above the peek height.

## 5. Settings dialog

`design-mobile-settings.png`: "Lokalizacja i alerty" mixes place, map layers, alerts and a privacy note. Split into **Miejsce** (live-suggest search, GPS, three recent places) and **Alerty**; move layer toggles to the map legend.

- The default intro says "GPS działa na telefonie poza tym podglądem — tu przeglądarka go blokuje" (`geoHint ??` fallback in `grom-app.tsx`), so real phone users are told GPS is blocked. Show only when `isEmbeddedPreview()`.
- Presets and hints ("deszcz, 30 min") are good but hidden until alerts are on; show them next to the CTA.
- "Włącz" with a BellOff icon reads as "muted". Use Bell + "Włącz alerty" and say before the tap: "Poprosimy o zgodę na powiadomienia".
- Checkboxes are 13px; no `aria-modal`, focus stays on the header button, and **Escape does not close it** (verified).
- "Testuj alert" is excellent; make it demo the sound too.

## 6. States and feedback

| State | Today | Gap |
|---|---|---|
| Loading | "Skanuję radar…" + "Echo brak" | False all-clear; no skeleton. |
| Stale radar | "sprzed 6 min" in expanded only | Nothing in peek; >30 min should go amber with "alert wstrzymany". |
| No echo | "Czysto" (`threat-sheet-logic.ts:60`) | Fine; add "najbliższe echo 48 km". |
| Fallback source | caption text | One-word chip "RainViewer" by the clock. |
| Radar/IMGW down | amber sentences | Read as weather warnings; use the status row. |
| Alert banner | tone border, icon, close | Good; no sign whether sound played or quiet hours muted it. |
| Quiet hours | settings only | Moon glyph next to the bell in the header. |
| Offline | nothing | "Bez sieci · ostatni radar 20:30". |
| Level | 1px sheet border (`PANEL`) | Too subtle; colour the level chip. |

## 7. Accessibility

- **Contrast** (from `styles.css` tokens): fg 15.3:1, muted 5.9:1, warn 7.7, danger 5.0, ok 6.4, accent 9.3 pass. **Faint `#5c6570` is 3.0:1 on surface and 2.7:1 on surface-2**, used at 10–12px for legend, ticks, captions and attribution. Lift to ~`#7a8593` (4.6:1).
- **Focus**: only `Button` has `focus-visible:ring` (`ui/button.tsx`); chips, city/preset buttons, the sheet handle, "pokaż" and both ranges have none.
- **Targets**: "pokaż" 36×16, chips 28px, checkboxes 13px. Header buttons 44px pass.
- **Timeline**: `role="img" aria-label="Oś czasu opadu"` conveys nothing. Generate "Opad od 20:40 do 21:10, najsilniej ok. 20:55"; the same sentence feeds the widget.
- **Handle**: `aria-controls="grom-threat-sheet"` targets its own parent article (`threat-sheet.tsx:138-140`); point at the content div.
- **Dialog**: no `aria-modal`, no trap, no Escape, background tabbable.
- **Motion**: no `prefers-reduced-motion` for `easeTo`/`fitBounds`, backdrop-blur or the tab-title flash (`stopTitleFlash`), which is itself a WCAG 2.3 concern.
- `lang="pl"`, h1→h2 order and `aria-live` on the banner are correct (polite is enough for `allclear`).

## 8. Copy and tone

Tone is right: "Ulewa nad Tobą", "To ruch echa, nie pewność", "Przeszło · Warszawa". Fixes:

- **Declension**: `nad ${who}` (`threat.ts:1062-1066`, `alerts.ts:308`) yields "nad Warszawa", "Dojście nad Warszawa". Add an instrumental form to `CITIES` (Warszawą, Krakowem, Łodzią, Wrocławiem…) with fallback "nad Twoją pinezką".
- **Genitive after "Spodziewaj się"**: "ulewy i porywistego wiatru", "silnej ulewy, porywów wiatru" (`expectPl`, `threat.ts:766`).
- **English leak**: `<Badge>{threat.level}</Badge>` prints NOW / IMMINENT / NEARBY / WATCH (`threat-sheet.tsx:190`, on every screenshot). "ETA" too.
- **Jargon**: TERYT (`threat-sheet.tsx:180`), echo, komórka, dBZ, SRI, COMPO_SRI, "stopień 2". Users say *chmura, deszcz, burza*.
- **Terms**: pinezka / punkt na mapie / lokalizacja / miasto / Twoja lokalizacja all appear. Use *pinezka* in the sheet, *miejsce* in settings.
- "→ na wschód" is read aloud as "strzałka w prawo"; write "od zachodu na wschód".

## 9. Mobile-native readiness

Single screen + sheet is right; no bottom nav. Sheet drag is handle-only with `touch-none` (`threat-sheet.tsx:134`) so map pan does not conflict, but content cannot be dragged closed and there is no scrim tap; adopt three detents with rubber-band. `theme-color #07090c` over a light map gives a black status bar on a light page in a PWA; add a 60px ink gradient behind the header or use `#e8edf2`. There is no manifest, maskable icon or service worker, so no install prompt, splash or offline. Icon: bolt on ink; splash: ink + bolt + "GROM". The widget reuses the headline and the timeline sentence.

## 10b. Prioritised changes

| # | Change | Why | Effort |
|---|---|---|---|
| 1 | Auto-expand to half detent; fit map to pin + track with sheet padding | Pin and echo hidden when they matter most | M |
| 2 | Track = amber `#f0a202` always; L3 = gold `#e8b400`; opacity 0.85 | Arrow/red-rain collision; yellow invisible | S |
| 3 | De-duplicate sheet; Polish level chip; drop TERYT | Same fact ×3; English NOW badge | S |
| 4 | Declension and genitive fixes in `threat.ts` / `alerts.ts` | Hero line is wrong in every storm | S |
| 5 | Timeline: clock ticks, now-cursor, aria sentence, tap value | Users think in clock time; strip is mute | M |
| 6 | One grey status row; attribution to "O danych" + one visible line | Amber notices read as warnings | S |
| 7 | Map controls: zoom, locate, legend, scale, attribution | Standard expectation, legal credit | M |
| 8 | 44px chips, focus rings on raw buttons/ranges, faint → 4.5:1 | Measured AA failures | S |
| 9 | Modal dialog (aria-modal, trap, Escape, scrim); split Miejsce/Alerty; embedded-only GPS copy | Non-modal; wrong copy on phones | M |
| 10 | Pin ring + halo drawn above tracks; dashed past segment | Pin is the smallest object; arrow covers it | S |
| 11 | "Echo —" while loading; stale >30 min amber in peek; offline banner | False all-clear; stale invisible | S |
| 12 | PWA shell: manifest, icon, SW, theme-color, reduced motion | Not installable; always animates | L |

## 10c. Wireframes

Phone, peek:

```
┌──────────────────────────────┐
│ ⚡GROM              ◎   ⚙    │  44px tiles
│                              │
│         map (Positron)       │
│       ┈┈┈→▶  ◉               │  dashed past · amber head · pin ring
│                       [+][−] │  zoom
│                       [◎][▤] │  locate / legend
├──────────────────────────────┤
│ ━━━                          │
│ Ulewa nad Tobą        TERAZ  │  H2 24 · level chip
│ Warszawa · od zachodu 41 km/h│
│ Za ile  teraz   Szansa  95%  │  mono
│ ▮▮▮▮▮▮▮▯▯▯▯▯▯▯▯▯▯▯          │  90-min strip + now-cursor
│ 20:36     21:00  21:30  22:00│
└──────────────────────────────┘
```

Phone, expanded (half → full):

```
│ Ulewa nad Tobą        TERAZ  │
│ Warszawa                     │
│ Od zachodu, 41 km/h · słabnie│
│ Spodziewaj się ulewy i       │
│ porywistego wiatru.          │
│ Za ile  teraz   Szansa  95%  │
│ [strip + clock ticks]        │
│ ▸ legenda                    │
│ Komórka może urosnąć na      │  caveat, muted
│ miejscu — radar tego nie     │
│ zapowie.                     │
│ IMGW: brak ostrzeżeń dla pow.│
│ Radar 20:30 · 6 min · IMGW ✕ │  status row, grey
│ O danych ›  Ostatnie alerty ›│
```

Widget / lock screen (medium):

```
┌──────────────────────────┐
│ ⚡ GROM · Warszawa  20:36 │
│ Ulewa za 12 min          │  20px
│ od zachodu · 41 km/h     │
│ ▮▮▯▯▮▮▮▮▮▮▯▯▯▯▯▯▯▯      │
│ teraz          +90 min   │
└──────────────────────────┘
```

## 10d. Design tokens (keeps the identity)

```css
/* surfaces */ --ink-0:#07090c; --ink-1:#12171f; --ink-2:#1a212c; --map:#e8edf2; --line:#2a3340;
/* text */     --fg:#e8edf2; --fg-muted:#9aa4b2 /*6.9:1*/; --fg-faint:#7a8593 /*4.6:1*/;
/* brand */    --accent:#6ec8d4; --accent-fg:#071114; --track:#f0a202; --track-ink:#12171f;
/* rain */     --rain-1:#36bae5; --rain-2:#005b8e; --rain-3:#e8b400; --rain-4:#d81e00; --hail:#ff77ff;
/* levels */   --lvl-clear:#5ea88a; --lvl-watch:#c9a36a; --lvl-nearby:#6ec8d4; --lvl-imminent:#f0a202; --lvl-now:#e25c4a;
/* status */   --stale:#c9a36a; --down:#8b95a3;
/* type */     display 30/1.05 600 · h2 24/1.1 600 · peek 20/1.1 600 · body 15/1.5 · small 13/1.45 · caption 12/1.4 500 (minimum) · num 14 mono tabular · num-lg 18 mono
/* space */    4 8 12 16 24 32   /* radius */ 8 12 16 24
/* sheet */    peek 128px · half 45dvh · full 85dvh   /* targets */ tap 44px · chip 36px
```

Rules: nothing below 12px; faint only at ≥14px or as decoration; red only for `now` and rain-4; amber only for the track and `imminent`; mono only for live numbers and clocks.
