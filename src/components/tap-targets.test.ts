import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "../..");
const CSS = readFileSync(join(ROOT, "src/styles.css"), "utf8");
const APP = readFileSync(join(HERE, "grom-app.tsx"), "utf8");
const SHEET = readFileSync(join(HERE, "threat-sheet.tsx"), "utf8");

/** 36–44px in Tailwind: h-9/min-h-9 (36) … h-11/min-h-11 (44). */
const CHIP_HEIGHT = /(?:min-)?h-(?:9|10|11)\b|(?:min-)?h-\[(?:3[6-9]|4[0-4])px\]/;
const FOCUS_RING = /focus-visible:ring-2/;

function constValue(name: string): string {
  const tpl = APP.match(new RegExp(`const ${name}\\s*=\\s*\`([\\s\\S]*?)\`;`));
  if (tpl) return interpolate(tpl[1]);
  const str = APP.match(new RegExp(`const ${name}\\s*=\\s*"([^"]*)"`));
  if (str) return interpolate(str[1]);
  throw new Error(`const ${name} not found`);
}

function interpolate(s: string): string {
  return s.replace(/\$\{(\w+)\}/g, (_, n) => {
    try {
      return constValue(n);
    } catch {
      return "";
    }
  });
}

/** Resolved class string of the nearest `<button` opening tag that contains `label`. */
function buttonClassBefore(src: string, label: string): string {
  const idx = src.indexOf(label);
  assert.ok(idx >= 0, `missing ${JSON.stringify(label)}`);
  const start = src.lastIndexOf("<button", idx);
  assert.ok(start >= 0, `no <button before ${JSON.stringify(label)}`);
  const end = src.indexOf(">", start);
  assert.ok(end > start, `unclosed <button before ${JSON.stringify(label)}`);
  return resolveClass(src.slice(start, end + 1));
}

function resolveClass(block: string): string {
  const quoted = block.match(/className="([^"]+)"/);
  if (quoted) return quoted[1];
  const ident = block.match(/className=\{(\w+)\}/);
  if (ident) return constValue(ident[1]);
  const cn = block.match(/className=\{cn\(([\s\S]*?)\)\}/);
  if (cn) {
    const parts: string[] = [];
    for (const q of cn[1].matchAll(/"([^"]+)"/g)) parts.push(q[1]);
    for (const id of cn[1].matchAll(/\b([A-Z][A-Z0-9_]*)\b/g)) {
      try {
        parts.push(constValue(id[1]));
      } catch {
        /* not a class const */
      }
    }
    assert.ok(parts.length, `cn() had no class parts in:\n${block.slice(0, 240)}`);
    return parts.join(" ");
  }
  assert.fail(`no className on button in:\n${block.slice(0, 240)}`);
}

function cityChipClass(): string {
  const slice = APP.match(/CITIES\.slice\(0, 12\)[\s\S]{0,360}className=\{cn\(([\s\S]*?)\)\}/);
  assert.ok(slice, "expected city chip className={cn(...)}");
  return resolveClass(`className={cn(${slice[1]})}`);
}

function presetChipClass(): string {
  const slice = APP.match(
    /ALERT_PRESET_ORDER\.map[\s\S]{0,480}className=\{cn\(([\s\S]*?)\)\}/,
  );
  assert.ok(slice, "expected alert preset chip className={cn(...)}");
  return resolveClass(`className={cn(${slice[1]})}`);
}

describe("faint contrast token (§7 / 10b#8)", () => {
  it("keeps --color-faint at ~5.5:1 on the daylight surface (#5d6b77)", () => {
    // Daylight redesign: faint ink sits on white cards now, not on dark panels.
    // #5d6b77 on #ffffff ≈ 5.5:1 — same AA intent as #7a8593 on the old dark surface.
    assert.match(CSS, /--color-faint:\s*#5d6b77\b/);
    assert.doesNotMatch(CSS, /--color-faint:\s*#5c6570\b/);
    assert.doesNotMatch(CSS, /--color-faint:\s*#7a8593\b/);
  });
});

describe("chip tap targets (§7 / 10b#8)", () => {
  it("pokaż is a 36–44px chip, not a 16px inline scrap", () => {
    const cls = buttonClassBefore(APP, "pokaż");
    assert.match(cls, CHIP_HEIGHT);
    assert.doesNotMatch(cls, /^(?:font-medium )?text-accent hover:text-fg$/);
  });

  it("map chips (Pokaż mżawkę, IMGW, tor komórki) are 36–44px", () => {
    const mapChip = constValue("MAP_CHIP");
    assert.match(mapChip, CHIP_HEIGHT);
    assert.match(APP, /className=\{MAP_CHIP\}[\s\S]{0,280}Pokaż mżawkę/);
    assert.match(APP, /className=\{MAP_CHIP\}[\s\S]{0,280}>IMGW</);
    const track = APP.match(/aria-pressed=\{tracksMap\}[\s\S]{0,200}className=\{cn\(([\s\S]*?)\)\}/);
    assert.ok(track, "expected tor komórki button className");
    assert.match(resolveClass(`className={cn(${track[1]})}`), CHIP_HEIGHT);
  });

  it("city and preset chips stay at least 36px", () => {
    assert.match(cityChipClass(), CHIP_HEIGHT);
    assert.match(presetChipClass(), CHIP_HEIGHT);
  });
});

describe("raw control focus rings (§7 / 10b#8)", () => {
  it("styles.css gives button and range a focus-visible ring like Button", () => {
    assert.match(CSS, /button:focus-visible/);
    assert.match(CSS, /input\[type=["']range["']\]:focus-visible/);
    assert.match(CSS, /ring-2|box-shadow|outline:\s*2px/);
  });

  it("pokaż, city chips, radar range, and the sheet handle carry a ring class", () => {
    assert.match(buttonClassBefore(APP, "pokaż"), FOCUS_RING);
    assert.match(cityChipClass(), FOCUS_RING);

    const range = APP.match(/aria-label="Czas radaru"/);
    assert.ok(range, "expected Czas radaru range");
    const rangeStart = APP.lastIndexOf("<input", range.index ?? 0);
    const rangeTag = APP.slice(rangeStart, (range.index ?? 0) + 40);
    assert.match(rangeTag, /RAW_FOCUS|focus-visible:ring-2/);

    const handle = SHEET.match(/<button\b[\s\S]{0,320}aria-controls="grom-threat-sheet"/);
    assert.ok(handle, "expected sheet handle button");
    assert.match(handle[0], FOCUS_RING);
  });
});
