import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  idzieOdEchoSuffix,
  sheetCaveat,
  sheetExtrasClass,
  SHEET_DETENT_CLASS,
  SHEET_NUMBER_CLASS,
  SHEET_NUMBER_PX,
  threatLevelChip,
} from "./threat-sheet-logic.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const SHEET = readFileSync(join(HERE, "threat-sheet.tsx"), "utf8");
const APP = readFileSync(join(HERE, "grom-app.tsx"), "utf8");

/** Sentences, tolerating Polish "ok." / "~20 min." inside one sentence. */
const SENTENCE_SPLIT = /(?<=[.!?])\s+(?=[A-ZŁŚŻĆÓĘĄŃ])/;

/** The peek block is the handle button body: everything a stranger reads in 3 s. */
function peekBlock(): string {
  const start = SHEET.indexOf('aria-controls="grom-threat-sheet"');
  assert.ok(start > 0, "expected the sheet handle button");
  const openTagEnd = SHEET.indexOf(">", SHEET.indexOf("onClick={onHandleClick}", start));
  const end = SHEET.indexOf("</button>", start);
  assert.ok(openTagEnd > 0 && end > openTagEnd, "unclosed sheet handle button");
  return SHEET.slice(openTagEnd, end);
}

/** The shared answer block: headline, chip, place, hero, Szansa, strip. */
function answerBlock(): string {
  const m = SHEET.match(/function Answer\(\{[\s\S]*?\n\}\n/);
  assert.ok(m, "expected the shared Answer block");
  return m[0];
}

/** Block of source that renders the two-sentence Idzie od / Spodziewaj się box. */
function boxBlock(): string {
  const m = SHEET.match(/\{threat && \([\s\S]*?Spodziewaj się[\s\S]*?\n {8}\) : null\}/);
  assert.ok(m, "expected the Idzie od / Spodziewaj się box");
  return m[0];
}

describe("peek is the product (§3 above-the-fold)", () => {
  it("peek prints headline, level chip, place, Za ile, Szansa and the strip", () => {
    const peek = peekBlock();
    assert.match(peek, /<Answer\b/);
    assert.match(peek, /headline=\{headline\}/);
    assert.match(peek, /status=\{peekStatus\}/);
    const answer = answerBlock();
    assert.match(answer, /\{headline\}/);
    assert.match(answer, /threatLevelChip\(threat\.level\)/);
    assert.match(answer, /\{place\.label\}/);
    assert.match(answer, />Za ile</);
    assert.match(answer, />Szansa</);
    assert.match(answer, /\{eta\}/);
    assert.match(answer, /\{chance\}/);
    assert.match(answer, /<Strip/);
  });

  it("peek and the expanded sheet share one answer block, so nothing resizes", () => {
    assert.equal((SHEET.match(/<Answer\b/g) ?? []).length, 2);
    assert.doesNotMatch(peekBlock(), /interactive/);
    assert.match(SHEET, /<Answer\s+interactive/);
  });

  it("peek has no nested scroller and no nested interactive control", () => {
    const peek = peekBlock();
    assert.doesNotMatch(peek, /overflow-y-auto|overflow-auto|overflow-scroll/);
    assert.doesNotMatch(peek, /<button/);
    assert.match(SHEET_DETENT_CLASS.peek, /overflow-hidden/);
    // The one scroller in the sheet is the expanded block on a phone, hidden while peeking.
    // The desktop card is content-sized: no max-h cap, no inner scroller (daylight redesign).
    const scrollers = SHEET.match(/overflow-y-auto/g) ?? [];
    assert.equal(scrollers.length, 1, "expected overflow-y-auto only on the phone's expanded block");
    assert.doesNotMatch(SHEET, /sm:overflow-y-auto/);
    assert.match(SHEET, /sm:max-h-none/);
    assert.match(SHEET, /!open && "hidden"/);
  });

  it("peek strip is static bars — the tappable strip belongs to the expanded sheet", () => {
    assert.match(SHEET, /interactive\?: boolean/);
    assert.match(answerBlock(), /interactive=\{interactive\}/);
    assert.match(SHEET, /interactive \? \(\s*<button/);
    assert.match(SHEET, /\) : \(\s*<span/);
  });
});

describe("Za ile is the hero number (§3 / 10d type)", () => {
  it("hero beats Szansa in the type scale and nothing drops below 12px", () => {
    assert.ok(SHEET_NUMBER_PX.hero > SHEET_NUMBER_PX.sub, "hero must be the largest number");
    assert.ok(SHEET_NUMBER_PX.heroWide > SHEET_NUMBER_PX.hero, "sm+ hero is the wider step");
    assert.ok(SHEET_NUMBER_PX.sub >= 12);
    assert.match(SHEET_NUMBER_CLASS.hero, /text-3xl/);
    assert.match(SHEET_NUMBER_CLASS.hero, /sm:text-4xl/);
    assert.match(SHEET_NUMBER_CLASS.sub, /text-lg/);
    for (const cls of Object.values(SHEET_NUMBER_CLASS)) {
      assert.match(cls, /font-mono/);
      assert.match(cls, /tabular-nums/);
    }
  });

  it("wires the hero class to Za ile and the small class to Szansa", () => {
    const hero = SHEET.match(/Za ile<\/dt>[\s\S]{0,160}?<\/dd>/g) ?? [];
    assert.equal(hero.length, 1, "one answer block owns Za ile");
    assert.match(hero[0], /SHEET_NUMBER_CLASS\.hero/);
    const chance = SHEET.match(/Szansa<\/dt>[\s\S]{0,160}?<\/dd>/g) ?? [];
    assert.equal(chance.length, 1, "one answer block owns Szansa");
    assert.match(chance[0], /SHEET_NUMBER_CLASS\.sub/);
    assert.doesNotMatch(chance[0], /SHEET_NUMBER_CLASS\.hero/);
  });

  it("keeps mono for Za ile / Szansa / clocks only", () => {
    assert.doesNotMatch(boxBlock(), /font-mono/);
    const caveat = SHEET.match(/honesty\.radar \?\? caveat[\s\S]{0,120}<\/p>/);
    assert.ok(caveat, "expected the caveat paragraph");
    assert.doesNotMatch(caveat[0], /font-mono/);
    const legend = SHEET.match(/LEGEND\.map[\s\S]{0,400}?\)\)\}/);
    assert.ok(legend, "expected the rain legend");
    assert.doesNotMatch(legend[0], /font-mono/);
  });

  it("keeps nothing below 12px in the sheet", () => {
    assert.doesNotMatch(SHEET, /text-\[(?:8|9|10|11)px\]/);
  });
});

describe("dropped from the sheet DOM (§3 / 10b#3)", () => {
  it("Echo is not a third KPI tile — distance rides the Idzie od line", () => {
    assert.doesNotMatch(SHEET, /label="Echo"/);
    assert.doesNotMatch(SHEET, />Echo<\/dt>/);
    assert.doesNotMatch(SHEET, /<PeekStat\b/);
    assert.doesNotMatch(SHEET, /function PeekStat\(/);
    assert.doesNotMatch(SHEET, /function Stat\(/);
    assert.match(SHEET, /idzieOdEchoSuffix\(/);
    assert.match(boxBlock(), /idzieOdEchoSuffix\(/);
  });

  it("folds the echo distance into Idzie od, in km, without the mono voice", () => {
    assert.equal(idzieOdEchoSuffix(13.4), " · echo 13 km");
    assert.equal(idzieOdEchoSuffix(null), "");
    assert.equal(idzieOdEchoSuffix(undefined), "");
  });

  it("has no English level words, no ETA and no TERYT", () => {
    assert.doesNotMatch(SHEET, /\bNOW\b|\bIMMINENT\b|\bNEARBY\b|\bWATCH\b|\bCLEAR\b/);
    assert.doesNotMatch(SHEET, /\bETA\b/);
    assert.doesNotMatch(SHEET, /TERYT/);
    assert.doesNotMatch(SHEET, /place\.terc/);
  });

  it("chips are the four Polish nowcast words — watch never contradicts a Czysto headline", () => {
    const shown = (["now", "imminent", "nearby", "watch", "clear"] as const).map((l) =>
      threatLevelChip(l).toUpperCase(),
    );
    assert.deepEqual(new Set(shown), new Set(["TERAZ", "ZARAZ", "BLISKO", "CZYSTO"]));
    assert.equal(threatLevelChip("watch"), "czysto");
  });

  it("prints the two-sentence box once — the caveat carries only what the box does not", () => {
    const detail =
      "Idzie od zachodu (~23 km/h), echo ok. 13 km od Krakowa. Dojście nad Krakowem: ok. 8 min. Szansa ~90%. To ruch echa, nie pewność. Komórka może też urosnąć na miejscu — tego radar nie zapowie.";
    const caveat = sheetCaveat(detail);
    assert.equal(
      caveat,
      "To ruch echa, nie pewność. Komórka może też urosnąć na miejscu — tego radar nie zapowie.",
    );
    assert.doesNotMatch(caveat ?? "", /Idzie od|Dojście|Szansa/);
  });

  it("keeps miss distance and the in-situ note, drops the duplicated chance", () => {
    const caveat = sheetCaveat(
      "Idzie od zachodu, echo ok. 30 km od Krakowa. Tor minie Kraków ok. 12 km obok za ~20 min. Nad samym punktem szansa ~40%. Komórka może też urosnąć na miejscu — tego radar nie zapowie.",
    );
    assert.match(caveat ?? "", /Tor minie Kraków ok\. 12 km obok za ~20 min\./);
    assert.match(caveat ?? "", /Komórka może też urosnąć na miejscu/);
    assert.doesNotMatch(caveat ?? "", /szansa ~40%/i);
  });

  it("never prints more than two caveat sentences, and nothing when there is nothing left", () => {
    const long = sheetCaveat(
      "Idzie od zachodu, echo ok. 5 km od Krakowa. Dojście nad Krakowem: ok. 3 min. Szansa ~95%. To ruch echa, nie pewność. Komórka może też urosnąć na miejscu — tego radar nie zapowie.",
    );
    assert.ok((long ?? "").split(SENTENCE_SPLIT).length <= 2);
    assert.equal(sheetCaveat("Idzie od zachodu, echo ok. 5 km od Krakowa."), null);
    assert.equal(sheetCaveat(null), null);
    assert.equal(sheetCaveat(""), null);
  });

  it("keeps the clear-sky sentence, which the box cannot print", () => {
    const caveat = sheetCaveat(
      "Nad Krakowem radar nie widzi groźnej komórki w promieniu 80 km. Szansa ~10% na ok. 45 min. Komórka może też urosnąć na miejscu — tego radar nie zapowie.",
    );
    assert.match(caveat ?? "", /radar nie widzi groźnej komórki/);
    assert.doesNotMatch(caveat ?? "", /Szansa ~10%/);
  });

  it("wires the sheet through sheetCaveat, not the raw detail string", () => {
    assert.match(SHEET, /sheetCaveat\(/);
    assert.doesNotMatch(SHEET, /honesty\.radar \?\? detail \?\? threat\?\.detail/);
  });
});

describe("detent content ladder (§2 fix)", () => {
  it("half keeps the box, one caveat and the status row; the long tail is full", () => {
    assert.equal(sheetExtrasClass("peek"), "max-sm:hidden");
    assert.equal(sheetExtrasClass("half"), "max-sm:hidden");
    assert.equal(sheetExtrasClass("full"), "");
    assert.match(SHEET, /sheetExtrasClass\(detent\)/);
    const box = boxBlock();
    assert.doesNotMatch(box, /extrasClass/);
    const status = SHEET.match(/\{statusRow \?[\s\S]{0,320}?\) : null\}/);
    assert.ok(status, "expected the status row");
    assert.doesNotMatch(status[0], /extrasClass/);
  });

  it("hides the honesty paragraph, the credit line and O danych until full", () => {
    const honesty = SHEET.match(/<p[^>]*>\s*\{?\s*Szansa, Za ile i alert są dla pinezki/);
    assert.ok(honesty, "expected the pin-honesty paragraph");
    assert.match(honesty[0], /extrasClass/);
    const credit = SHEET.match(/<p[^>]*>\s*\{SHEET_CREDIT_LINE\}/);
    assert.ok(credit, "expected the credit line");
    assert.match(credit[0], /extrasClass/);
    const details = SHEET.match(/<details[^>]*>/);
    assert.ok(details, "expected O danych details");
    assert.match(details[0], /extrasClass/);
  });

  it("does not touch the shipped detent heights", () => {
    assert.match(SHEET_DETENT_CLASS.peek, /max-h-\[128px\]/);
    assert.match(SHEET_DETENT_CLASS.half, /max-h-\[45dvh\]/);
    assert.match(SHEET_DETENT_CLASS.full, /max-h-\[85dvh\]/);
    assert.doesNotMatch(SHEET, /max-h-\[70dvh\]/);
  });
});

describe("extras gate never clobbers flex rows", () => {
  it("the gate is max-sm:hidden — a bare hidden wins over flex in tailwind-merge", () => {
    const gate = sheetExtrasClass("peek");
    assert.equal(gate, "max-sm:hidden");
    // cn("flex …", "hidden sm:block") resolves to block: the strip's label row
    // rendered "90 minz ruchu echa" and the legend "ulewny >10nic w oknie 90 min".
    assert.doesNotMatch(gate, /(?:^|\s)hidden(?:\s|$)/);
    assert.doesNotMatch(gate, /sm:block/);
  });

  it("strip label and legend rows stay flex under the gate", () => {
    assert.match(SHEET, /flex items-baseline justify-between gap-2 text-xs", extrasClass/);
    assert.match(SHEET, /flex flex-wrap items-center gap-x-3 gap-y-1[^"]*"\s*,\s*extrasClass/);
    assert.match(SHEET, /Opad nad pinezką · 90 min/);
    assert.match(SHEET, /nic w oknie 90 min/);
  });
});

describe("wordmark and IMGW chip (§1)", () => {
  it("shrinks the wordmark tile to a bolt plus GROM", () => {
    assert.match(APP, /\bZap\b/);
    assert.match(APP, /<Zap className="size-\d/);
    const h1 = APP.match(/<h1[\s\S]{0,200}?<\/h1>/);
    assert.ok(h1, "expected the GROM wordmark h1");
    assert.match(h1[0], /GROM/);
    assert.match(h1[0], /text-(?:base|lg)\b/);
    assert.doesNotMatch(APP, /Nowcast PL/);
  });

  it("stops painting the IMGW chip vermilion — warn token, not rain-4 red", () => {
    assert.doesNotMatch(APP, /#e4572e/);
    assert.match(APP, /const IMGW_CHIP_ON = "var\(--color-warn\)"/);
    assert.match(APP, /const CHIP_OFF = "var\(--color-faint\)"/);
    const chip = APP.match(/aria-pressed=\{imgwMap\}[\s\S]{0,400}?IMGW</);
    assert.ok(chip, "expected the IMGW map chip");
    assert.match(chip[0], /imgwMap \? IMGW_CHIP_ON : CHIP_OFF/);
  });
});
