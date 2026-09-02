import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { overlayFallback } from "./sri-overlay.ts";
import {
  formatRadarClock,
  radarAgeCaption,
  radarAgeMin,
  radarPaintSource,
  radarPaintWho,
  rewriteArrivalMinutes,
  nowCursorFrac,
  wallClockAxisLabel,
  wallClockMin,
} from "./wall-clock.ts";

const APP_SRC = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../../components/grom-app.tsx"),
  "utf8",
);

test("frame-time 18 min minus age 11 min is 7 min from now", () => {
  assert.equal(wallClockMin(18, 11), 7);
});

test("wall-clock minutes floor at 0", () => {
  assert.equal(wallClockMin(5, 11), 0);
  assert.equal(wallClockMin(0, 6), 0);
  assert.equal(wallClockMin(11, 11), 0);
});

test("zero frame age leaves frame-time unchanged (hindcast / just-published)", () => {
  assert.equal(wallClockMin(18, 0), 18);
  assert.equal(wallClockMin(0, 0), 0);
});

test("radarAgeMin is minutes since the scan, floored at 0", () => {
  const radar = 1_700_000_000;
  const now = (radar + 11 * 60) * 1000;
  assert.equal(radarAgeMin(radar, now), 11);
  assert.equal(radarAgeMin(radar, radar * 1000), 0);
  assert.equal(radarAgeMin(null, now), 0);
  assert.equal(radarAgeMin(radar + 60, radar * 1000), 0);
});

test("formatRadarClock is Europe/Warsaw, not the process TZ", () => {
  const cest = Date.UTC(2026, 8, 1, 15, 15, 0) / 1000;
  const cet = Date.UTC(2026, 0, 15, 15, 15, 0) / 1000;
  assert.equal(formatRadarClock(cest), "17:15");
  assert.equal(formatRadarClock(cet), "16:15");
});

test("map slider clock is formatRadarClock, not an unpinned locale clock", () => {
  assert.match(APP_SRC, /aria-label="Czas radaru"/);
  assert.match(APP_SRC, /aria-label="Czas radaru"[\s\S]{0,500}formatRadarClock\(/);
  assert.doesNotMatch(APP_SRC, /function formatClock/);
});

test("sheet caption prints the radar clock and its age", () => {
  const radar = Date.UTC(2026, 7, 31, 9, 15, 0) / 1000;
  const now = Date.UTC(2026, 7, 31, 9, 21, 0);
  assert.equal(radarAgeCaption(radar, now), "Radar 11:15 · sprzed 6 min");
  assert.equal(radarAgeCaption(radar, now, "rainviewer"), "Radar 11:15 · sprzed 6 min");
  assert.equal(radarAgeCaption(radar, now, "sri"), "Radar IMGW 11:15 · sprzed 6 min");
  assert.equal(radarAgeCaption(radar, now, "placeholder"), "Radar 11:15 · poprzednia klatka");
  assert.equal(radarAgeCaption(null, now), null);
});

test("caption follows map paint, not analysisSource", () => {
  const radar = Date.UTC(2026, 7, 31, 9, 15, 0) / 1000;
  const now = Date.UTC(2026, 7, 31, 9, 21, 0);
  const analysisSri = "sri" as const;

  const rainviewerPaint = overlayFallback({
    overlaysAvailable: true,
    png: null,
    queryError: true,
    queryFetched: true,
    isPlaceholder: false,
  });
  const rainviewerCaption = radarAgeCaption(radar, now, radarPaintSource(rainviewerPaint));
  assert.equal(analysisSri, "sri");
  assert.equal(radarPaintSource(rainviewerPaint), "rainviewer");
  assert.equal(rainviewerCaption, "Radar 11:15 · sprzed 6 min");
  assert.doesNotMatch(rainviewerCaption ?? "", /Radar IMGW/);
  assert.equal(radarPaintWho("rainviewer"), "Radar");

  const sriPaint = overlayFallback({
    overlaysAvailable: true,
    png: "x",
    queryError: false,
    queryFetched: true,
    isPlaceholder: false,
  });
  assert.equal(radarPaintSource(sriPaint), "sri");
  assert.equal(radarAgeCaption(radar, now, radarPaintSource(sriPaint)), "Radar IMGW 11:15 · sprzed 6 min");
  assert.equal(radarPaintWho("sri"), "Radar IMGW");

  const stalePaint = overlayFallback({
    overlaysAvailable: true,
    png: "x",
    queryError: false,
    queryFetched: false,
    isPlaceholder: true,
  });
  const staleCaption = radarAgeCaption(radar, now, radarPaintSource(stalePaint));
  assert.equal(radarPaintSource(stalePaint), "placeholder");
  assert.equal(staleCaption, "Radar 11:15 · poprzednia klatka");
  assert.doesNotMatch(staleCaption ?? "", /Radar IMGW/);
  assert.equal(radarPaintWho("placeholder"), "poprzednia klatka");
});

test("Dojście / za ~N min copy subtracts age; 0 becomes teraz", () => {
  const dojscie = "Idzie od zachodu, echo ok. 20 km od Kraków. Dojście nad Kraków: ok. 18 min.";
  assert.equal(
    rewriteArrivalMinutes(dojscie, 18, 11),
    "Idzie od zachodu, echo ok. 20 km od Kraków. Dojście nad Kraków: ok. 7 min.",
  );
  assert.equal(
    rewriteArrivalMinutes(dojscie, 18, 18),
    "Idzie od zachodu, echo ok. 20 km od Kraków. Dojście nad Kraków: teraz.",
  );
  const miss = "Tor minie Kraków ok. 12 km obok za ~18 min.";
  assert.equal(rewriteArrivalMinutes(miss, 18, 11), "Tor minie Kraków ok. 12 km obok za ~7 min.");
  assert.equal(rewriteArrivalMinutes(miss, 18, 20), "Tor minie Kraków ok. 12 km obok teraz.");
  assert.equal(
    rewriteArrivalMinutes("Nad X radar nie widzi groźnej komórki. Szansa ~10% na ok. 45 min.", null, 11),
    "Nad X radar nie widzi groźnej komórki. Szansa ~10% na ok. 45 min.",
  );
});

test("timeline axis labels are HH:MM Warsaw clocks, not age-shifted minutes", () => {
  // 20:30 CEST on the review evening — age 6 min used to print "teraz 24 54 84 min".
  const radar = Date.UTC(2026, 8, 1, 18, 30, 0) / 1000;
  assert.equal(formatRadarClock(radar), "20:30");
  assert.equal(wallClockAxisLabel(0, radar), "20:30");
  assert.equal(wallClockAxisLabel(30, radar), "21:00");
  assert.equal(wallClockAxisLabel(60, radar), "21:30");
  assert.equal(wallClockAxisLabel(90, radar), "22:00");
  for (const t of [0, 30, 60, 90]) {
    assert.match(wallClockAxisLabel(t, radar), /^\d{2}:\d{2}$/);
    assert.doesNotMatch(wallClockAxisLabel(t, radar), /min|teraz/i);
  }
});

test("now-cursor sits at radar age along the 90-min strip", () => {
  assert.equal(nowCursorFrac(0), 0);
  assert.equal(nowCursorFrac(6, 90), 6 / 90);
  assert.equal(nowCursorFrac(90), 1);
  assert.equal(nowCursorFrac(120), 1);
  assert.equal(nowCursorFrac(-3), 0);
});
