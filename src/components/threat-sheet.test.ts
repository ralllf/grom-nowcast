import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { etaLabel, lightningCaption, shouldAutoExpandSheet } from "./threat-sheet-logic.ts";
import type { Threat } from "@/lib/weather/types";

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
    assert.equal(lightningCaption(0, true), "Brak wyładowań w tej sesji");
  });

  it("says minie only when the cell misses and echo is 20–80 km", () => {
    assert.equal(etaLabel(threat({ willHit: false, missKm: 12, nearestKm: 40 })), "minie");
    assert.equal(etaLabel(threat({ willHit: false, missKm: 12, nearestKm: 10 })), "—");
  });
});
