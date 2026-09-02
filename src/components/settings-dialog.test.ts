import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  GPS_BLOCKED_INTRO,
  SETTINGS_INTRO,
  isSettingsScrimClick,
  locateGpsHint,
  settingsIntroCopy,
  shouldCloseSettingsOnKey,
  tabWrapTarget,
} from "./settings-dialog-logic.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = readFileSync(join(HERE, "grom-app.tsx"), "utf8");

describe("settings dialog close (§5 / §7 Dialog / 10b#9)", () => {
  it("Escape closes the dialog; other keys do not", () => {
    assert.equal(shouldCloseSettingsOnKey("Escape"), true);
    assert.equal(shouldCloseSettingsOnKey("Enter"), false);
    assert.equal(shouldCloseSettingsOnKey("Tab"), false);
    assert.match(APP, /shouldCloseSettingsOnKey/);
  });

  it("scrim tap closes; a click on the panel does not", () => {
    const scrim = { id: "scrim" };
    const panel = { id: "panel" };
    assert.equal(isSettingsScrimClick(scrim, scrim), true);
    assert.equal(isSettingsScrimClick(panel, scrim), false);
    assert.match(APP, /isSettingsScrimClick/);
  });
});

describe("GPS fallback copy gated (§5 / 10b#9)", () => {
  it("phone users get a place-only intro, not the preview GPS-blocked line", () => {
    const phone = settingsIntroCopy(null, false);
    assert.equal(phone, SETTINGS_INTRO);
    assert.doesNotMatch(phone, /blokuje|podglądem/);
    assert.match(SETTINGS_INTRO, /Wybierz miasto/);
  });

  it("embedded preview keeps the GPS-blocked fallback", () => {
    assert.equal(settingsIntroCopy(null, true), GPS_BLOCKED_INTRO);
    assert.match(GPS_BLOCKED_INTRO, /GPS działa na telefonie poza tym podglądem/);
  });

  it("geoHint wins over both fallbacks", () => {
    assert.equal(settingsIntroCopy("custom", false), "custom");
    assert.equal(settingsIntroCopy("custom", true), "custom");
  });

  it("locate() GPS-blocked hint is only for isEmbeddedPreview()", () => {
    assert.match(locateGpsHint(true, false) ?? "", /blokuje GPS/);
    assert.equal(locateGpsHint(false, false), null);
    assert.equal(locateGpsHint(false, true), null);
  });

  it("grom-app wires intro through settingsIntroCopy + isEmbeddedPreview()", () => {
    assert.match(APP, /settingsIntroCopy\(/);
    assert.match(APP, /isEmbeddedPreview\(\)/);
    assert.match(APP, /locateGpsHint\(/);
    assert.doesNotMatch(
      APP,
      /geoHint \?\?\s*"Wybierz miasto albo stuknij mapę\. GPS działa/,
    );
  });
});

describe("settings dialog a11y wiring (§7 Dialog / 10b#9)", () => {
  it("marks the dialog aria-modal and traps Tab inside it", () => {
    assert.match(APP, /aria-modal=\{true\}|aria-modal="true"/);
    assert.match(APP, /tabWrapTarget/);
    const first = { id: "close" };
    const last = { id: "search" };
    assert.equal(tabWrapTarget(false, [first, last], last), first);
    assert.equal(tabWrapTarget(true, [first, last], first), last);
    assert.equal(tabWrapTarget(false, [first, last], first), null);
  });
});

/** Markup from the dialog title through HourSelect (the panel, not map chrome). */
function settingsPanel(src: string): string {
  const start = src.indexOf('id="settings-title"');
  assert.ok(start >= 0, "settings-title missing");
  const end = src.indexOf("function HourSelect");
  assert.ok(end > start, "HourSelect sentinel missing");
  return src.slice(start, end);
}

/** Slice from a heading/tab label to the next, or to the end of the panel. */
function sectionAfter(panel: string, startLabel: string, endLabel: string | null): string {
  const start = panel.search(new RegExp(`>${startLabel}<`));
  assert.ok(start >= 0, `missing ${startLabel} heading/tab`);
  if (!endLabel) return panel.slice(start);
  const rest = panel.slice(start + startLabel.length + 2);
  const rel = rest.search(new RegExp(`>${endLabel}<`));
  assert.ok(rel >= 0, `missing ${endLabel} heading/tab after ${startLabel}`);
  return panel.slice(start, start + startLabel.length + 2 + rel);
}

describe("settings dialog split Miejsce / Alerty (§5 / 10b#9)", () => {
  it("exposes Miejsce and Alerty as headings or tabs", () => {
    const panel = settingsPanel(APP);
    assert.match(panel, />Miejsce</);
    assert.match(panel, />Alerty</);
  });

  it("keeps city chips under Miejsce, not Alerty", () => {
    const panel = settingsPanel(APP);
    const miejsce = sectionAfter(panel, "Miejsce", "Alerty");
    const alerty = sectionAfter(panel, "Alerty", null);
    assert.match(miejsce, /CITIES\.slice\(0, 12\)/);
    assert.doesNotMatch(alerty, /CITIES\.slice\(0, 12\)/);
  });

  it("keeps Testuj alert under Alerty, not Miejsce", () => {
    const panel = settingsPanel(APP);
    const miejsce = sectionAfter(panel, "Miejsce", "Alerty");
    const alerty = sectionAfter(panel, "Alerty", null);
    assert.match(alerty, /Testuj alert/);
    assert.doesNotMatch(miejsce, /Testuj alert/);
  });

  it("puts GPS locate under Miejsce (existing locate(), no new API)", () => {
    const miejsce = sectionAfter(settingsPanel(APP), "Miejsce", "Alerty");
    assert.match(miejsce, /onClick=\{locate\}/);
    assert.match(miejsce, /Użyj GPS/);
  });

  it("drops layer checkboxes from the dialog (map chips stay)", () => {
    const panel = settingsPanel(APP);
    assert.doesNotMatch(panel, /Ostrzeżenia IMGW na mapie/);
    assert.doesNotMatch(panel, /Pokaż mżawkę na mapie/);
    assert.match(APP, /Pokaż mżawkę/);
    assert.match(APP, />IMGW</);
  });
});
