import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  SHEET_CARD_CLASS,
  SHEET_CARD_GRID_CLASS,
  SHEET_CELL_ANSWER_CLASS,
  SHEET_CELL_BOX_CLASS,
  SHEET_CELL_FULL_CLASS,
  SHEET_CELL_STRIP_CLASS,
  SHEET_CREDIT_LINE,
  SHEET_DATA_DETAILS,
  SHEET_DETENT_CLASS,
  sheetExtrasClass,
} from "./threat-sheet-logic.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const SHEET = readFileSync(join(HERE, "threat-sheet.tsx"), "utf8");
const APP = readFileSync(join(HERE, "grom-app.tsx"), "utf8");

/** The `<details>` disclosure that owns the long tail. */
function tailDisclosure(): string {
  const m = SHEET.match(/<details[\s\S]*?<\/details>/);
  assert.ok(m, "expected the O danych disclosure");
  return m[0];
}

/** Rendered copy a 1280 visitor reads before opening a disclosure — imports excluded. */
function firstScreen(): string {
  const body = SHEET.slice(SHEET.indexOf("export function ThreatSheet"));
  return body.replace(/<details[\s\S]*?<\/details>/g, "");
}

/** Source of the shared answer block. */
function answerBlock(): string {
  const m = SHEET.match(/function Answer\(\{[\s\S]*?\n\}\n/);
  assert.ok(m, "expected the shared Answer block");
  return m[0];
}

/** The expanded block: phone scroller, sm+ card. */
function cardBlock(): string {
  const start = SHEET.indexOf('!open && "hidden"');
  assert.ok(start > 0, "expected the expanded sheet block");
  const open = SHEET.lastIndexOf("<div", start);
  const end = SHEET.indexOf(">", SHEET.indexOf(")}", start));
  assert.ok(open >= 0 && end > open, "unclosed expanded sheet block");
  return SHEET.slice(open, end + 1);
}

/** Opening tag of the nearest element that renders `marker`. */
function tagOf(marker: string): string {
  const idx = SHEET.indexOf(marker);
  assert.ok(idx > 0, `missing ${marker}`);
  const from = Math.max(
    SHEET.lastIndexOf("<p ", idx),
    SHEET.lastIndexOf("<button", idx),
    SHEET.lastIndexOf("<details", idx),
  );
  assert.ok(from >= 0, `no element before ${marker}`);
  const end = SHEET.indexOf(">", SHEET.indexOf("className", from));
  assert.ok(end > from && end < idx, `unclosed element before ${marker}`);
  return SHEET.slice(from, end + 1);
}

describe("desktop card is two columns of the page (§ pin card at 1280)", () => {
  it("gives sm+ a two-column grid instead of a phone card in a box", () => {
    assert.match(SHEET_CARD_GRID_CLASS, /\bsm:grid\b/);
    assert.match(SHEET_CARD_GRID_CLASS, /sm:grid-cols-\[minmax\(0,[^\]]*\)_minmax\(0,[^\]]*\)\]/);
    assert.match(SHEET_CARD_GRID_CLASS, /sm:items-start/);
    assert.match(SHEET_CELL_ANSWER_CLASS, /sm:col-start-1/);
    assert.match(SHEET_CELL_ANSWER_CLASS, /sm:row-start-1/);
    assert.match(SHEET_CELL_STRIP_CLASS, /sm:col-start-2/);
    assert.match(SHEET_CELL_STRIP_CLASS, /sm:row-start-1/);
    assert.match(SHEET_CELL_BOX_CLASS, /sm:col-start-1/);
    assert.match(SHEET_CELL_BOX_CLASS, /sm:row-start-2/);
    assert.match(SHEET_CELL_FULL_CLASS, /sm:col-span-2/);
  });

  it("wires the answer left, the strip right and Idzie od under the answer", () => {
    assert.match(cardBlock(), /SHEET_CARD_GRID_CLASS/);
    const expanded = SHEET.match(/<Answer\s+interactive[\s\S]*?\/>/);
    assert.ok(expanded, "expected the expanded-sheet Answer");
    assert.match(expanded[0], /cellClass=\{SHEET_CELL_ANSWER_CLASS\}/);
    assert.match(expanded[0], /stripClass=\{SHEET_CELL_STRIP_CLASS\}/);
    const answer = answerBlock();
    assert.match(answer, /cellClass/);
    assert.match(answer, /stripClass/);
    assert.match(answer, /<Strip/);
    const box = SHEET.match(/\{threat && \([\s\S]*?Spodziewaj się[\s\S]*?\n {8}\) : null\}/);
    assert.ok(box, "expected the Idzie od / Spodziewaj się box");
    assert.match(box[0], /SHEET_CELL_BOX_CLASS/);
  });

  it("keeps the rows under the two columns full width, not in column 2", () => {
    for (const marker of [
      "honesty.radar ?? caveat",
      "{imgwLine}",
      "{statusRow.text}",
      "{geoError}",
      "Pokaż ruch opadu na mapie",
    ]) {
      assert.match(tagOf(marker), /sm:col-span-2|SHEET_CELL_FULL_CLASS/, `${marker} must span the card`);
    }
    assert.match(tailDisclosure(), /SHEET_CELL_FULL_CLASS|sm:col-span-2/);
  });

  it("does not fake the layout with zoom or transform: scale", () => {
    for (const src of [SHEET, APP]) {
      assert.doesNotMatch(src, /\bzoom-\[|\bzoom:\s*\d/);
      assert.doesNotMatch(src, /scale\(\s*0?\.\d/);
      assert.doesNotMatch(src, /\bsm:scale-\d|\blg:scale-\d/);
    }
  });

  it("widens the pin column to at most 32rem and keeps the right half for the map", () => {
    const col = APP.match(/lg:grid-cols-\[minmax\(0,(\d+)rem\)_1fr\]/);
    assert.ok(col, "expected the lg pin column track");
    const rem = Number(col[1]);
    assert.ok(rem >= 26 && rem <= 32, `pin column ${rem}rem must stay between 26 and 32rem`);
  });
});

describe("no scroller inside the desktop card (§ 1280 overflow)", () => {
  it("drops the sm max-height clamp and the sm scroller", () => {
    assert.doesNotMatch(SHEET, /sm:overflow-y-auto/);
    assert.doesNotMatch(SHEET, /sm:max-h-\[calc\(100dvh-20rem\)\]/);
    assert.match(SHEET_CARD_CLASS, /sm:max-h-none/);
    assert.match(SHEET_CARD_CLASS, /sm:overflow-visible/);
    assert.match(SHEET, /SHEET_CARD_CLASS/);
  });

  it("leaves exactly one scroller in the sheet — the phone block", () => {
    const scrollers = SHEET.match(/overflow-y-auto/g) ?? [];
    assert.equal(scrollers.length, 1, "the phone expanded block is the only scroller");
    assert.match(cardBlock(), /overflow-y-auto/);
    assert.match(cardBlock(), /sm:overflow-visible/);
  });

  it("adds no fourth detent to make the card fit", () => {
    assert.deepEqual(Object.keys(SHEET_DETENT_CLASS), ["peek", "half", "full"]);
  });
});

describe("long tail stays behind the disclosure (§ first screen)", () => {
  it("puts the pin honesty, the credit line and O danych behind one summary", () => {
    const tail = tailDisclosure();
    assert.match(tail, /O danych ›/);
    assert.match(tail, /Szansa, Za ile i alert są dla pinezki/);
    assert.match(tail, /SHEET_CREDIT_LINE/);
    assert.match(tail, /SHEET_DATA_DETAILS/);
    assert.doesNotMatch(SHEET, /<details[^>]*\bopen\b/);
    assert.match(SHEET_CREDIT_LINE, /IMGW-PIB/);
    assert.match(SHEET_DATA_DETAILS, /POLRAD/);
  });

  it("keeps that tail out of the first screen a 1280 visitor reads", () => {
    const visible = firstScreen();
    assert.doesNotMatch(visible, /Szansa, Za ile i alert są dla pinezki/);
    assert.doesNotMatch(visible, /SHEET_CREDIT_LINE/);
    assert.doesNotMatch(visible, /SHEET_DATA_DETAILS/);
    assert.doesNotMatch(visible, /O danych/);
    // The answer itself still is the first screen.
    assert.match(visible, />Za ile</);
    assert.match(visible, />Szansa</);
    assert.match(visible, /<Strip/);
  });
});

describe("phone sheet is untouched (§ 390×844)", () => {
  it("keeps peek at 128px, half at 45dvh and full at 85dvh", () => {
    assert.match(SHEET_DETENT_CLASS.peek, /max-h-\[128px\]/);
    assert.match(SHEET_DETENT_CLASS.peek, /overflow-hidden/);
    assert.match(SHEET_DETENT_CLASS.half, /max-h-\[45dvh\]/);
    assert.match(SHEET_DETENT_CLASS.full, /max-h-\[85dvh\]/);
    assert.match(SHEET, /SHEET_DETENT_CLASS\[detent\]/);
    assert.match(SHEET, /detent === "peek" && "min-h-24"/);
  });

  it("keeps the peek block free of a nested scroller and nested buttons", () => {
    const start = SHEET.indexOf('aria-controls="grom-threat-sheet"');
    assert.ok(start > 0, "expected the sheet handle button");
    const openTagEnd = SHEET.indexOf(">", SHEET.indexOf("onClick={onHandleClick}", start));
    const peek = SHEET.slice(openTagEnd, SHEET.indexOf("</button>", start));
    assert.doesNotMatch(peek, /overflow-y-auto|overflow-auto|overflow-scroll/);
    assert.doesNotMatch(peek, /<button/);
    assert.doesNotMatch(peek, /SHEET_CELL_|cellClass|stripClass/);
  });

  it("keeps the phone extras ladder and hides the handle on sm+", () => {
    assert.equal(sheetExtrasClass("peek"), "hidden sm:block");
    assert.equal(sheetExtrasClass("half"), "hidden sm:block");
    assert.equal(sheetExtrasClass("full"), "");
    assert.match(SHEET, /sm:hidden/);
  });
});
