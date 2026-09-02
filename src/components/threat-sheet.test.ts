import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  echoLabel,
  etaLabel,
  idzieOdLine,
  imgwAsideCountLine,
  lightningCaption,
  isOfflineFailure,
  sheetPeekStatus,
  sheetSourceHonesty,
  sheetStatusRow,
  shouldAutoExpandSheet,
  threatLevelChip,
  timelineAriaLabel,
  timelineBarReadout,
} from "./threat-sheet-logic.ts";
import { STALE_RADAR_MIN } from "../lib/weather/alerts.ts";
import { IMGW_WARNINGS_UNAVAILABLE, RADAR_UNAVAILABLE } from "../lib/weather/snapshot.ts";
import type { Threat } from "@/lib/weather/types";

const HERE = dirname(fileURLToPath(import.meta.url));
const SHEET_SRC = readFileSync(join(HERE, "threat-sheet.tsx"), "utf8");
const APP_SRC = readFileSync(join(HERE, "grom-app.tsx"), "utf8");
const MAP_SRC = readFileSync(join(HERE, "radar-map.tsx"), "utf8");

function threat(partial: Partial<Threat>): Threat {
  return {
    level: "clear",
    title: "Czysto",
    detail: "",
    etaMin: null,
    approaching: false,
    receding: false,
    speedKmh: null,
    nearestKm: null,
    maxLevel: 0,
    pinLevel: 0,
    cellLevel: 0,
    chancePct: 10,
    comingFrom: null,
    toward: null,
    willHit: false,
    missKm: null,
    expect: null,
    track: null,
    tracks: [],
    matchedWarnings: [],
    timeline: [],
    timelineAdvected: false,
    lightningNearCell: false,
    cellTrend: null,
    ...partial,
  };
}

describe("shouldAutoExpandSheet", () => {
  it("stays collapsed on desktop even for now", () => {
    assert.equal(shouldAutoExpandSheet("now", true), false);
  });

  it("expands on mobile for imminent and now", () => {
    assert.equal(shouldAutoExpandSheet("imminent", false), true);
    assert.equal(shouldAutoExpandSheet("now", false), true);
  });

  it("does not expand for quieter levels", () => {
    assert.equal(shouldAutoExpandSheet("clear", false), false);
    assert.equal(shouldAutoExpandSheet("watch", false), false);
    assert.equal(shouldAutoExpandSheet("nearby", false), false);
    assert.equal(shouldAutoExpandSheet(undefined, false), false);
  });

  it("now/imminent auto height is half (45dvh), not 70dvh", async () => {
    const logic = await import("./threat-sheet-logic.ts");
    assert.equal(logic.autoExpandDetent("now", false), "half");
    assert.equal(logic.autoExpandDetent("imminent", false), "half");
    assert.equal(logic.autoExpandDetent("now", true), null);
    assert.equal(logic.autoExpandDetent("nearby", false), null);
    assert.equal(logic.SHEET_DETENT_CLASS.half.includes("max-h-[45dvh]"), true);
    assert.match(SHEET_SRC, /SHEET_DETENT_CLASS\[detent\]/);
    assert.match(SHEET_SRC, /max-h-\[45dvh\]|SHEET_DETENT_CLASS/);
    assert.doesNotMatch(SHEET_SRC, /max-h-\[70dvh\]/);
  });
});

describe("sheet detents and map padding", () => {
  it("names peek / half / full heights", async () => {
    const { SHEET_DETENT_CLASS, sheetHeightPx } = await import("./threat-sheet-logic.ts");
    assert.match(SHEET_DETENT_CLASS.peek, /max-h-\[128px\]/);
    assert.match(SHEET_DETENT_CLASS.half, /max-h-\[45dvh\]/);
    assert.match(SHEET_DETENT_CLASS.full, /max-h-\[85dvh\]/);
    assert.equal(sheetHeightPx("peek", 800), 128);
    assert.equal(sheetHeightPx("half", 800), 360);
    assert.equal(sheetHeightPx("full", 800), 680);
  });

  it("fitBounds bottom padding is sheetPx + 24", async () => {
    const { sheetFitPadding } = await import("./threat-sheet-logic.ts");
    assert.deepEqual(sheetFitPadding(360), { top: 90, right: 90, bottom: 384, left: 90 });
    assert.deepEqual(sheetFitPadding(0), { top: 90, right: 90, bottom: 90, left: 90 });
  });

  it("place-change offset lifts the centre by half the sheet", async () => {
    const { placeChangeOffset } = await import("./threat-sheet-logic.ts");
    assert.deepEqual(placeChangeOffset(360), [0, -180]);
    assert.deepEqual(placeChangeOffset(0), [0, 0]);
  });

  it("wires fitBounds padding and easeTo offset through the helpers", () => {
    assert.match(MAP_SRC, /sheetFitPadding\(/);
    assert.match(MAP_SRC, /placeChangeOffset\(/);
    assert.match(MAP_SRC, /offset:\s*placeChangeOffset\(/);
    assert.doesNotMatch(MAP_SRC, /padding:\s*90,/);
  });

  it("only fitBounds on auto-expand; grom-app threads the detent into the map", () => {
    const apply = SHEET_SRC.match(/function applyDetent\([\s\S]*?\n  \}/);
    assert.ok(apply, "expected applyDetent in threat-sheet.tsx");
    assert.doesNotMatch(apply[0], /onShowRainMotion/);
    assert.match(SHEET_SRC, /applyDetent\(target\);\s*onShowRainMotionRef\.current\(\)/);
    assert.match(APP_SRC, /sheetDetent=\{sheetDetent\}/);
    assert.match(APP_SRC, /onDetentChange=\{setSheetDetent\}/);
  });

  it("snaps the handle across peek → half → full", async () => {
    const { nextSheetDetent, toggleSheetDetent } = await import("./threat-sheet-logic.ts");
    assert.equal(nextSheetDetent("peek", -40), "half");
    assert.equal(nextSheetDetent("half", -40), "full");
    assert.equal(nextSheetDetent("full", 40), "half");
    assert.equal(nextSheetDetent("half", 40), "peek");
    assert.equal(toggleSheetDetent("peek"), "half");
    assert.equal(toggleSheetDetent("half"), "peek");
    assert.equal(toggleSheetDetent("full"), "peek");
  });
});

describe("nowcastHeadline", () => {
  it("keeps radar copy in the headline slot", async () => {
    const { nowcastHeadline } = await import("./threat-sheet-logic.ts");
    assert.equal(nowcastHeadline(threat({ level: "imminent", title: "Ulewa nadciąga" }), false), "Ulewa nadciąga");
    assert.equal(nowcastHeadline(threat({ level: "now", title: "Ulewa nad Tobą" }), false), "Ulewa nad Tobą");
    assert.equal(nowcastHeadline(threat({ level: "clear", title: "Czysto" }), false), "Czysto");
  });

  it("does not put Ostrzeżenie IMGW in the nowcast headline", async () => {
    const { nowcastHeadline } = await import("./threat-sheet-logic.ts");
    assert.equal(
      nowcastHeadline(threat({ level: "watch", title: "Ostrzeżenie IMGW" }), false),
      "Czysto",
    );
  });

  it("keeps pending / empty states", async () => {
    const { nowcastHeadline } = await import("./threat-sheet-logic.ts");
    assert.equal(nowcastHeadline(null, true), "Skanuję radar…");
    assert.equal(nowcastHeadline(null, false), "Brak danych");
  });
});

describe("cellTrendLine", () => {
  it("prints Komórka rośnie / słabnie and stays quiet when steady", async () => {
    const { cellTrendLine } = await import("./threat-sheet-logic.ts");
    assert.equal(cellTrendLine("growing"), "Komórka rośnie");
    assert.equal(cellTrendLine("decaying"), "Komórka słabnie");
    assert.equal(cellTrendLine(null), null);
  });
});

describe("etaLabel", () => {
  it("uses teraz when eta is 0", () => {
    assert.equal(etaLabel(threat({ etaMin: 0 })), "teraz");
  });

  it("prints minutes when eta is set", () => {
    assert.equal(etaLabel(threat({ etaMin: 18 })), "18 min");
  });

  it("subtracts radar age: frame-time 18 min, age 11 min → 7 min", () => {
    assert.equal(etaLabel(threat({ etaMin: 18 }), 11), "7 min");
  });

  it("floors a spent ETA at teraz", () => {
    assert.equal(etaLabel(threat({ etaMin: 8 }), 11), "teraz");
  });

  it("empty lightning session uses the no-strikes copy", () => {
    assert.equal(lightningCaption(0, false), "Brak wyładowań w tej sesji");
  });

  it("gated PERUN fetch uses the IMGW-style unavailable line", () => {
    assert.equal(lightningCaption(0, true), "Wyładowania chwilowo niedostępne");
  });

  it("says minie only when the cell misses and echo is 20–80 km", () => {
    assert.equal(etaLabel(threat({ willHit: false, missKm: 12, nearestKm: 40 })), "minie");
    assert.equal(etaLabel(threat({ willHit: false, missKm: 12, nearestKm: 10 })), "—");
  });
});

describe("imgwAsideCountLine", () => {
  it("does not print 0 burzowych while snapshot is missing", () => {
    const line = imgwAsideCountLine(undefined);
    assert.equal(line, null);
    assert.equal(line?.includes("0 burzowych"), undefined);
  });

  it("does not print a fake zero-count when warningsUnavailable", () => {
    const line = imgwAsideCountLine({ stormWarningCount: 0, warningsUnavailable: true });
    assert.equal(line, null);
    assert.ok(!String(line).includes("0 burzowych"));
  });

  it("prints the real count only after IMGW settled", () => {
    assert.equal(imgwAsideCountLine({ stormWarningCount: 0, warningsUnavailable: false }), "0 burzowych w kraju");
    assert.equal(imgwAsideCountLine({ stormWarningCount: 3, warningsUnavailable: false }), "3 burzowych w kraju");
  });
});

describe("echoLabel", () => {
  it("prints an em dash while threat is still null, not brak", () => {
    assert.equal(echoLabel(null), "—");
    assert.notEqual(echoLabel(null), "brak");
  });

  it("still says brak when a real threat has no echo", () => {
    assert.equal(echoLabel(threat({ nearestKm: null })), "brak");
  });

  it("prints distance once an echo exists", () => {
    assert.equal(echoLabel(threat({ nearestKm: 12.4 })), "12 km");
  });

  it("wires both Echo stats through echoLabel", () => {
    assert.match(SHEET_SRC, /const echo = echoLabel\(threat\)/);
    assert.match(SHEET_SRC, /PeekStat label="Echo" value=\{echo\}/);
    assert.match(SHEET_SRC, /Stat label="Echo" value=\{echoFull\}/);
    assert.doesNotMatch(
      SHEET_SRC,
      /threat\?\.nearestKm != null \? `\$\{threat\.nearestKm\.toFixed\(0\)\} km` : "brak"/,
    );
  });
});

describe("threatLevelChip", () => {
  it("prints Polish for every threat.level, not the English enum key", () => {
    assert.equal(threatLevelChip("now"), "teraz");
    assert.equal(threatLevelChip("imminent"), "zaraz");
    assert.equal(threatLevelChip("nearby"), "blisko");
    assert.equal(threatLevelChip("watch"), "uwaga");
    assert.equal(threatLevelChip("clear"), "czysto");
  });

  it("wires the sheet Badge through threatLevelChip", () => {
    assert.match(SHEET_SRC, /<Badge tone=\{TONE\[threat\.level\]\}>\{threatLevelChip\(threat\.level\)\}<\/Badge>/);
    assert.doesNotMatch(SHEET_SRC, /<Badge tone=\{TONE\[threat\.level\]\}>\{threat\.level\}<\/Badge>/);
  });
});

describe("threat-sheet user copy", () => {
  it("west→east Idzie od line is Polish words, not an arrow glyph", () => {
    const line = idzieOdLine("zachodu", "wschód");
    assert.equal(line, "Idzie od zachodu na wschód");
    assert.doesNotMatch(line, /→/);
    assert.match(SHEET_SRC, /idzieOdTowardSuffix\(threat\.toward\)/);
    assert.doesNotMatch(SHEET_SRC, /→ na/);
  });

  it("box owns Spodziewaj się / Komórka; grey paragraph is threat.detail only", () => {
    assert.match(SHEET_SRC, /Spodziewaj się:[\s\S]{0,80}\{threat\.expect\}/);
    assert.match(SHEET_SRC, /\{trendLine \? \(/);
    assert.match(SHEET_SRC, /honesty\.radar \?\? detail \?\? threat\?\.detail/);
    const grey = SHEET_SRC.match(
      /<p className="mt-3 max-w-prose[\s\S]*?<\/p>/,
    );
    assert.ok(grey, "expected the muted detail paragraph");
    assert.doesNotMatch(grey[0], /Spodziewaj się/);
    assert.doesNotMatch(grey[0], /threat\.expect/);
    assert.doesNotMatch(grey[0], /trendLine/);
  });

  it("does not print TERYT for a Warszawa pin — place stays the city name", () => {
    assert.match(SHEET_SRC, /\{place\.label\}/);
    assert.doesNotMatch(SHEET_SRC, /TERYT \{place\.terc\}/);
    assert.doesNotMatch(SHEET_SRC, />TERYT /);
  });

  it("does not leak leadMin into the honesty paragraph", () => {
    const honesty = SHEET_SRC.match(
      /Szansa, Za ile i alert są dla pinezki[\s\S]*?opad dojdzie\./,
    );
    assert.ok(honesty, "expected the pin-honesty paragraph in threat-sheet.tsx");
    assert.doesNotMatch(honesty[0], /leadMin/);
  });

  it("prints Za ile on the trio, not the English ETA acronym", () => {
    assert.match(SHEET_SRC, /PeekStat label="Za ile" value=\{eta\}/);
    assert.match(SHEET_SRC, /Stat label="Za ile" value=\{eta\}/);
    assert.match(SHEET_SRC, /PeekStat label="Szansa"/);
    assert.match(SHEET_SRC, /Stat label="Szansa"/);
    assert.match(SHEET_SRC, /PeekStat label="Echo"/);
    assert.match(SHEET_SRC, /Stat label="Echo"/);
    assert.doesNotMatch(SHEET_SRC, /label="ETA"/);
    assert.doesNotMatch(SHEET_SRC, /\bETA\b/);
  });

  it("names the painted map source on the map chip, not analysisSource", () => {
    assert.match(APP_SRC, /aria-label="Źródło radaru na mapie"/);
    assert.match(APP_SRC, /radarPaintWho\(radarPaint\)/);
    assert.doesNotMatch(APP_SRC, /analysisSource=\{snapshot\?\.radar\.analysisSource\}/);
    assert.doesNotMatch(SHEET_SRC, /analysisSource/);
  });

  it("collapses IMGW and PERUN outages into one status row, not amber alert sentences", () => {
    assert.match(SHEET_SRC, /sheetStatusRow\(/);
    assert.match(SHEET_SRC, /statusRow\.text/);
    assert.doesNotMatch(SHEET_SRC, /Wyładowania chwilowo niedostępne/);
    assert.doesNotMatch(SHEET_SRC, /Ostrzeżenia IMGW chwilowo niedostępne/);
    assert.doesNotMatch(SHEET_SRC, /honesty\.imgw \?/);
    assert.doesNotMatch(SHEET_SRC, /lightningNote/);
    assert.doesNotMatch(
      SHEET_SRC,
      /lightningUnavailable\s*\n\s*\? "mt-2 text-center text-\[11px\] text-warn"/,
    );
  });

  it("shows stale/offline status in the peek block, not only expanded", () => {
    const handle = SHEET_SRC.match(/sm:hidden[\s\S]*?<\/button>/);
    assert.ok(handle, "expected the mobile peek handle");
    assert.match(handle[0], /peekStatus/);
    assert.match(handle[0], /peekStatus\.text/);
    assert.match(SHEET_SRC, /sheetPeekStatus\(/);
    assert.match(SHEET_SRC, /offline/);
    assert.match(APP_SRC, /navigator\.onLine/);
    assert.match(APP_SRC, /offline=\{/);
  });
});

describe("sheet attribution (§3 / 10b#6)", () => {
  const JARGON = /POLRAD|dBZ|Marshall–Palmer|COMPO_SRI/;

  function alwaysVisibleSheetCopy(src: string): string {
    return src.replace(/<details[\s\S]*?<\/details>/g, "");
  }

  it("keeps one visible Dane: IMGW-PIB · mapa OpenFreeMap/OSM line", async () => {
    const logic = await import("./threat-sheet-logic.ts");
    assert.equal(logic.SHEET_CREDIT_LINE, "Dane: IMGW-PIB · mapa OpenFreeMap/OSM");
    assert.doesNotMatch(logic.SHEET_CREDIT_LINE, JARGON);
    assert.match(SHEET_SRC, /SHEET_CREDIT_LINE/);
    assert.match(SHEET_SRC, /O danych/);
  });

  it("does not dump COMPO_SRI/dBZ as always-visible body copy", () => {
    const visible = alwaysVisibleSheetCopy(SHEET_SRC);
    assert.doesNotMatch(visible, /COMPO_SRI/);
    assert.doesNotMatch(visible, /\bdBZ\b/);
    assert.doesNotMatch(visible, /Marshall–Palmer/);
    assert.doesNotMatch(visible, /POLRAD/);
  });

  it("puts POLRAD / dBZ / Marshall–Palmer / COMPO_SRI behind O danych ›", async () => {
    const logic = await import("./threat-sheet-logic.ts");
    assert.match(logic.SHEET_DATA_DETAILS, /POLRAD/);
    assert.match(logic.SHEET_DATA_DETAILS, /dBZ/);
    assert.match(logic.SHEET_DATA_DETAILS, /Marshall–Palmer/);
    assert.match(logic.SHEET_DATA_DETAILS, /COMPO_SRI/);
    assert.match(SHEET_SRC, /<details/);
    assert.match(SHEET_SRC, /<summary[\s\S]*O danych ›/);
    assert.match(SHEET_SRC, /SHEET_DATA_DETAILS/);
    const details = SHEET_SRC.match(/<details[\s\S]*?<\/details>/);
    assert.ok(details, "expected <details> O danych on the expanded sheet");
    assert.match(details[0], /O danych/);
    assert.match(details[0], /SHEET_DATA_DETAILS/);
  });

  it("does not replace the map chrome OpenFreeMap/OSM credit", async () => {
    const { MAP_CREDIT } = await import("./map-chrome-logic.ts");
    const logic = await import("./threat-sheet-logic.ts");
    assert.equal(MAP_CREDIT, "OpenFreeMap / OSM");
    assert.notEqual(logic.SHEET_CREDIT_LINE, MAP_CREDIT);
  });
});

describe("isOfflineFailure", () => {
  it("is true when the browser is offline", () => {
    assert.equal(isOfflineFailure({ browserOnline: false }), true);
    assert.equal(isOfflineFailure({ browserOnline: true }), false);
  });

  it("treats a fetch that failed as offline", () => {
    assert.equal(
      isOfflineFailure({
        browserOnline: true,
        queryError: true,
        error: new TypeError("Failed to fetch"),
      }),
      true,
    );
    assert.equal(
      isOfflineFailure({
        browserOnline: true,
        queryError: true,
        error: new TypeError("NetworkError when attempting to fetch resource."),
      }),
      true,
    );
  });

  it("does not call a server 500 offline", () => {
    assert.equal(
      isOfflineFailure({
        browserOnline: true,
        queryError: true,
        error: new Error("Internal Server Error"),
      }),
      false,
    );
    assert.equal(
      isOfflineFailure({
        browserOnline: true,
        queryError: false,
        error: new TypeError("Failed to fetch"),
      }),
      false,
    );
  });
});

describe("sheetStatusRow", () => {
  const radar = Date.UTC(2026, 7, 31, 18, 30, 0) / 1000;
  const nowMs = Date.UTC(2026, 7, 31, 18, 36, 0);

  it("prints Radar clock · age · IMGW ✕ · wyładowania ✕", () => {
    const row = sheetStatusRow({
      radarTime: radar,
      nowMs,
      warningsUnavailable: true,
      lightningUnavailable: true,
    });
    assert.ok(row);
    assert.equal(row.text, "Radar 20:30 · 6 min · IMGW ✕ · wyładowania ✕");
    assert.equal(row.tone, "mute");
  });

  it("marks IMGW and lightning with ✓ when both feeds are up", () => {
    const row = sheetStatusRow({
      radarTime: radar,
      nowMs,
      warningsUnavailable: false,
      lightningUnavailable: false,
    });
    assert.ok(row);
    assert.equal(row.text, "Radar 20:30 · 6 min · IMGW ✓ · wyładowania ✓");
    assert.equal(row.tone, "mute");
  });

  it("stays grey when only IMGW or PERUN is down — those are not weather warnings", () => {
    const imgwDown = sheetStatusRow({
      radarTime: radar,
      nowMs,
      warningsUnavailable: true,
      lightningUnavailable: false,
    });
    assert.equal(imgwDown?.tone, "mute");
    assert.match(imgwDown?.text ?? "", /IMGW ✕/);
    assert.doesNotMatch(imgwDown?.text ?? "", /Ostrzeżenia IMGW chwilowo niedostępne/);

    const perunDown = sheetStatusRow({
      radarTime: radar,
      nowMs,
      warningsUnavailable: false,
      lightningUnavailable: true,
    });
    assert.equal(perunDown?.tone, "mute");
    assert.match(perunDown?.text ?? "", /wyładowania ✕/);
    assert.doesNotMatch(perunDown?.text ?? "", /Wyładowania chwilowo niedostępne/);
  });

  it("is amber only when the radar itself is down", () => {
    const row = sheetStatusRow({
      radarTime: null,
      nowMs,
      radarUnavailable: true,
      warningsUnavailable: true,
      lightningUnavailable: true,
    });
    assert.ok(row);
    assert.equal(row.tone, "warn");
    assert.equal(row.text, "Radar ✕ · IMGW ✕ · wyładowania ✕");
  });

  it("is amber when radar age is past the stale gate", () => {
    const staleNow = Date.UTC(2026, 7, 31, 19, 1, 0);
    const row = sheetStatusRow({
      radarTime: radar,
      nowMs: staleNow,
      warningsUnavailable: true,
      lightningUnavailable: true,
    });
    assert.ok(row);
    assert.equal(row.tone, "warn");
    assert.ok(Math.round((staleNow / 1000 - radar) / 60) > STALE_RADAR_MIN);
    assert.match(row.text, /^Radar 20:30 · 31 min/);
    assert.match(row.text, /alert wstrzymany/);
  });

  it("stale >30 min marks the peek/status amber", () => {
    const staleNow = Date.UTC(2026, 7, 31, 19, 1, 0);
    const row = sheetStatusRow({
      radarTime: radar,
      nowMs: staleNow,
    });
    const peek = sheetPeekStatus(row, false);
    assert.ok(peek);
    assert.equal(peek.tone, "warn");
    assert.match(peek.text, /alert wstrzymany/);
    assert.ok(Math.round((staleNow / 1000 - radar) / 60) > STALE_RADAR_MIN);
  });

  it("fresh radar stays grey and stays out of peek", () => {
    const row = sheetStatusRow({
      radarTime: radar,
      nowMs,
    });
    assert.equal(row?.tone, "mute");
    assert.doesNotMatch(row?.text ?? "", /alert wstrzymany/);
    assert.equal(sheetPeekStatus(row, false), null);
  });

  it("offline copy is Bez sieci · ostatni radar HH:MM", () => {
    const row = sheetStatusRow({
      radarTime: radar,
      nowMs,
      offline: true,
    });
    assert.ok(row);
    assert.equal(row.text, "Bez sieci · ostatni radar 20:30");
    assert.equal(row.tone, "mute");
    const peek = sheetPeekStatus(row, true);
    assert.ok(peek);
    assert.equal(peek.text, "Bez sieci · ostatni radar 20:30");
  });

  it("offline with no last radar still says Bez sieci", () => {
    const row = sheetStatusRow({
      radarTime: null,
      nowMs,
      offline: true,
    });
    assert.ok(row);
    assert.equal(row.text, "Bez sieci");
    assert.equal(sheetPeekStatus(row, true)?.text, "Bez sieci");
  });

  it("offline last radar past the stale gate is amber and holds alerts", () => {
    const staleNow = Date.UTC(2026, 7, 31, 19, 1, 0);
    const row = sheetStatusRow({
      radarTime: radar,
      nowMs: staleNow,
      offline: true,
    });
    assert.equal(row?.tone, "warn");
    assert.match(row?.text ?? "", /Bez sieci · ostatni radar 20:30/);
    assert.match(row?.text ?? "", /alert wstrzymany/);
    assert.equal(sheetPeekStatus(row, true)?.tone, "warn");
  });

  it("radar-down is amber in peek", () => {
    const row = sheetStatusRow({
      radarTime: null,
      nowMs,
      radarUnavailable: true,
    });
    assert.equal(sheetPeekStatus(row, false)?.tone, "warn");
  });

  it("query error is amber radar-down, not an IMGW sentence", () => {
    const row = sheetStatusRow({
      radarTime: null,
      nowMs,
      queryError: true,
      warningsUnavailable: false,
      lightningUnavailable: false,
    });
    assert.equal(row?.tone, "warn");
    assert.match(row?.text ?? "", /Radar ✕/);
    assert.doesNotMatch(row?.text ?? "", /ostrzeż/i);
  });

  it("returns null while radar time is still unknown and not failed", () => {
    assert.equal(
      sheetStatusRow({
        radarTime: null,
        nowMs,
        warningsUnavailable: false,
        lightningUnavailable: true,
      }),
      null,
    );
  });
});

describe("sheetSourceHonesty", () => {
  it("names radar only when radar is down", () => {
    const h = sheetSourceHonesty({ radarUnavailable: true });
    assert.equal(h.radar, RADAR_UNAVAILABLE);
    assert.match(h.radar ?? "", /radaru/);
    assert.doesNotMatch(h.radar ?? "", /albo|ostrzeżeń/);
    assert.equal(h.imgw, null);
  });

  it("names ostrzeżenia only when IMGW is down", () => {
    const h = sheetSourceHonesty({ warningsUnavailable: true });
    assert.equal(h.imgw, IMGW_WARNINGS_UNAVAILABLE);
    assert.match(h.imgw ?? "", /ostrzeż/i);
    assert.doesNotMatch(h.imgw ?? "", /albo|radaru/);
    assert.equal(h.radar, null);
  });

  it("keeps sources on separate lines when both are down — no albo", () => {
    const h = sheetSourceHonesty({ radarUnavailable: true, warningsUnavailable: true });
    assert.equal(h.radar, RADAR_UNAVAILABLE);
    assert.equal(h.imgw, IMGW_WARNINGS_UNAVAILABLE);
    const combined = `${h.radar} ${h.imgw}`;
    assert.doesNotMatch(combined, /albo/);
    assert.doesNotMatch(combined, /radaru albo ostrzeżeń/);
  });

  it("query error names radar, not ostrzeżenia", () => {
    const h = sheetSourceHonesty({ queryError: true });
    assert.equal(h.radar, RADAR_UNAVAILABLE);
    assert.doesNotMatch(h.radar ?? "", /albo|ostrzeżeń/);
    assert.equal(h.imgw, null);
  });
});

describe("timeline clocks and aria", () => {
  const radar = Date.UTC(2026, 8, 1, 18, 30, 0) / 1000;

  it("aria-label is a real sentence with Warsaw clocks, not empty Oś czasu opadu", () => {
    const points = [
      { t: 0, level: 0 as const, rate: 0 },
      { t: 10, level: 2 as const, rate: 2 },
      { t: 25, level: 4 as const, rate: 12 },
      { t: 40, level: 1 as const, rate: 0.6 },
      { t: 90, level: 0 as const, rate: 0 },
    ];
    const label = timelineAriaLabel(points, radar);
    assert.equal(label, "Opad od 20:40 do 21:10, najsilniej ok. 20:55");
    assert.doesNotMatch(label, /Oś czasu opadu/);
  });

  it("dry window still speaks clocks, not a mute axis name", () => {
    const label = timelineAriaLabel(
      [
        { t: 0, level: 0 as const, rate: 0 },
        { t: 90, level: 0 as const, rate: 0 },
      ],
      radar,
    );
    assert.equal(label, "Brak opadu od 20:30 do 22:00");
    assert.doesNotMatch(label, /Oś czasu opadu/);
  });

  it("tap readout is clock plus intensity, not +N min", () => {
    assert.equal(
      timelineBarReadout({ t: 25, level: 4, rate: 12 }, radar),
      "20:55: ulewny, ~12 mm/h",
    );
    assert.equal(timelineBarReadout({ t: 0, level: 0, rate: 0 }, radar), "20:30: sucho");
    assert.equal(
      timelineBarReadout({ t: 10, level: 0, rate: 0, unknown: true }, radar),
      "20:40: poza radarem",
    );
    assert.doesNotMatch(timelineBarReadout({ t: 30, level: 2, rate: 3 }, radar), /\+\d+ min|teraz/);
  });

  it("sheet wires Warsaw clocks, now-cursor, aria sentence, and tap readout", () => {
    assert.match(SHEET_SRC, /wallClockAxisLabel\(0, radarTime\)/);
    assert.match(SHEET_SRC, /wallClockAxisLabel\(30, radarTime\)/);
    assert.match(SHEET_SRC, /wallClockAxisLabel\(90, radarTime\)/);
    assert.match(SHEET_SRC, /timelineAriaLabel\(/);
    assert.match(SHEET_SRC, /data-now-cursor/);
    assert.match(SHEET_SRC, /nowCursorFrac\(/);
    assert.match(SHEET_SRC, /timelineBarReadout\(/);
    assert.doesNotMatch(SHEET_SRC, /aria-label="Oś czasu opadu"/);
    assert.doesNotMatch(SHEET_SRC, /wallClockAxisLabel\(0, ageMin\)/);
    assert.doesNotMatch(SHEET_SRC, /\+\$\{wall\} min/);
  });
});
