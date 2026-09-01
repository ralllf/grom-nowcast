import assert from "node:assert/strict";
import test from "node:test";
import {
  formatRadarClock,
  radarAgeCaption,
  radarAgeMin,
  rewriteArrivalMinutes,
  wallClockAxisLabel,
  wallClockMin,
} from "./wall-clock.ts";

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

test("sheet caption prints the radar clock and its age", () => {
  const radar = Date.UTC(2026, 7, 31, 9, 15, 0) / 1000;
  const now = Date.UTC(2026, 7, 31, 9, 21, 0);
  assert.equal(radarAgeCaption(radar, now), "Radar 11:15 · sprzed 6 min");
  assert.equal(radarAgeCaption(radar, now, "rainviewer"), "Radar 11:15 · sprzed 6 min");
  assert.equal(radarAgeCaption(radar, now, "sri"), "Radar IMGW 11:15 · sprzed 6 min");
  assert.equal(radarAgeCaption(null, now), null);
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

test("timeline axis labels subtract age and print teraz at 0", () => {
  assert.equal(wallClockAxisLabel(0, 11), "teraz");
  assert.equal(wallClockAxisLabel(30, 11), "19");
  assert.equal(wallClockAxisLabel(90, 11, true), "79 min");
  assert.equal(wallClockAxisLabel(0, 0), "teraz");
  assert.equal(wallClockAxisLabel(90, 0, true), "90 min");
});
