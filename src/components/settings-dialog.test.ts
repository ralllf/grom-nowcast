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
