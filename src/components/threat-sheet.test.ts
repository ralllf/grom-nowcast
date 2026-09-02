import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  echoLabel,
  etaLabel,
  imgwAsideCountLine,
  lightningCaption,
  sheetSourceHonesty,
  shouldAutoExpandSheet,
  threatLevelChip,
} from "./threat-sheet-logic.ts";
import { IMGW_WARNINGS_UNAVAILABLE, RADAR_UNAVAILABLE } from "../lib/weather/snapshot.ts";
import type { Threat } from "@/lib/weather/types";

const HERE = dirname(fileURLToPath(import.meta.url));
const SHEET_SRC = readFileSync(join(HERE, "threat-sheet.tsx"), "utf8");
const APP_SRC = readFileSync(join(HERE, "grom-app.tsx"), "utf8");

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
  it("does not print TERYT for a Warszawa pin — place stays the city name", () => {
    assert.match(SHEET_SRC, /\{place\.label\}/);
    assert.doesNotMatch(SHEET_SRC, /TERYT \{place\.terc\}/);
    assert.doesNotMatch(SHEET_SRC, />TERYT /);
  });

  it("does not leak leadMin into the honesty paragraph", () => {
    const honesty = SHEET_SRC.match(
      /Szansa, ETA i alert są dla pinezki[\s\S]*?opad dojdzie\./,
    );
    assert.ok(honesty, "expected the pin-honesty paragraph in threat-sheet.tsx");
    assert.doesNotMatch(honesty[0], /leadMin/);
  });

  it("names the painted map source, not analysisSource", () => {
    assert.match(SHEET_SRC, /radarPaint/);
    assert.match(SHEET_SRC, /radarAgeCaption\(radarTime, nowMs, radarPaint\)/);
    assert.doesNotMatch(SHEET_SRC, /radarAgeCaption\(radarTime, nowMs, analysisSource\)/);
    assert.match(APP_SRC, /radarPaint=\{radarPaint\}/);
    assert.match(APP_SRC, /aria-label="Źródło radaru na mapie"/);
    assert.doesNotMatch(APP_SRC, /analysisSource=\{snapshot\?\.radar\.analysisSource\}/);
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
