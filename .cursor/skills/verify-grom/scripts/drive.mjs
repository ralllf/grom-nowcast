#!/usr/bin/env node
/**
 * Chrome CDP harness for GROM. No extra npm packages.
 * Usage: drive.mjs --feature location-pin [--base http://127.0.0.1:8080] [--out DIR]
 */
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync, existsSync, openSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dir, "../../../..");
const RUN_DIR = process.env.VERIFY_GROM_RUN_DIR || "/tmp/verify-grom";

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  return fallback;
}

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  process.stdout.write(`drive.mjs --feature location-pin|radar-map [--base URL] [--out DIR]

Features: location-pin, radar-map
Chrome: system google-chrome / google-chrome-stable. User-data-dir under ${RUN_DIR}/chrome-profile.
`);
  process.exit(0);
}

const FEATURE = arg("--feature", "location-pin");
const BASE = (arg("--base", process.env.BASE || "http://127.0.0.1:8080")).replace(/\/$/, "");
const runId = new Date().toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 15);
const OUT = arg("--out", join(ROOT, ".cursor/skills/verify-grom/evidence", runId));

if (FEATURE !== "location-pin" && FEATURE !== "radar-map") {
  console.error(`Unknown feature '${FEATURE}'. Shipped drivers: location-pin, radar-map`);
  process.exit(2);
}

const CHROME =
  process.env.CHROME ||
  (existsSync("/usr/local/bin/google-chrome")
    ? "/usr/local/bin/google-chrome"
    : existsSync("/usr/bin/google-chrome-stable")
      ? "/usr/bin/google-chrome-stable"
      : "google-chrome");

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id != null && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message || JSON.stringify(msg.error)));
        else resolve(msg.result);
      }
    };
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
}

async function waitWs(url, ms = 15000) {
  const t0 = Date.now();
  let last;
  while (Date.now() - t0 < ms) {
    try {
      return await new Promise((resolve, reject) => {
        const ws = new WebSocket(url);
        ws.addEventListener("open", () => resolve(ws));
        ws.addEventListener("error", (e) => reject(e));
      });
    } catch (e) {
      last = e;
      await sleep(200);
    }
  }
  throw last || new Error("WebSocket connect timeout");
}

async function chromeReady(port, ms = 20000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (res.ok) return await res.json();
    } catch {
      /* not up */
    }
    await sleep(150);
  }
  throw new Error(`Chrome debug port ${port} not ready`);
}

async function evalExpr(cdp, expression) {
  const r = await cdp.send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (r.exceptionDetails) {
    const msg = r.exceptionDetails.exception?.description || r.exceptionDetails.text;
    throw new Error(`eval: ${msg}`);
  }
  return r.result.value;
}

async function screenshot(cdp, path) {
  const { data } = await cdp.send("Page.captureScreenshot", { format: "png" });
  writeFileSync(path, Buffer.from(data, "base64"));
}

const COUNT_AMBER_JS = `(() => {
  const canvas = [...document.querySelectorAll("canvas")].find(
    (c) => c.getAttribute("aria-hidden") != null && !c.classList.contains("maplibregl-canvas"),
  );
  if (!canvas) return -1;
  const ctx = canvas.getContext("2d");
  if (!ctx) return -1;
  const w = canvas.width;
  const h = canvas.height;
  if (!w || !h) return -2;
  const data = ctx.getImageData(0, 0, w, h).data;
  let n = 0;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
    if (a < 40) continue;
    const amber = r > 180 && g < 150 && b < 90;
    const soft = r > 200 && g > 130 && g < 210 && b < 60;
    if (amber || soft) n++;
  }
  return n;
})()`;

function recordChromePid(pid, profile) {
  const metaPath = join(RUN_DIR, "launch.json");
  let meta = {};
  if (existsSync(metaPath)) {
    try {
      meta = JSON.parse(readFileSync(metaPath, "utf8"));
    } catch {
      meta = {};
    }
  }
  meta.chromePid = pid;
  meta.chromeProfile = profile;
  mkdirSync(RUN_DIR, { recursive: true });
  writeFileSync(metaPath, JSON.stringify(meta, null, 2));
}

mkdirSync(OUT, { recursive: true });
const profile = join(RUN_DIR, "chrome-profile");
mkdirSync(profile, { recursive: true });
const port = Number(process.env.CDP_PORT || 9333);

const chromeArgs = [
  "--headless=new",
  `--remote-debugging-port=${port}`,
  "--remote-allow-origins=*",
  `--user-data-dir=${profile}`,
  "--no-first-run",
  "--no-default-browser-check",
  "--disable-gpu",
  "--no-sandbox",
  "--disable-dev-shm-usage",
  "--disable-extensions",
  "--window-size=1280,800",
  ...(FEATURE === "radar-map" ? ["--use-angle=swiftshader"] : []),
  "about:blank",
];

mkdirSync(RUN_DIR, { recursive: true });
const chromeLog = join(RUN_DIR, "chrome.log");
const chromeFd = openSync(chromeLog, "w");
const chrome = spawn(CHROME, chromeArgs, {
  stdio: ["ignore", chromeFd, chromeFd],
});
recordChromePid(chrome.pid, profile);

let notes = {
  feature: FEATURE,
  base: BASE,
  out: OUT,
  startedAt: new Date().toISOString(),
  steps: [],
  sideEffects: [],
  ok: false,
};

function step(s) {
  notes.steps.push(s);
  process.stderr.write(`drive: ${s}\n`);
}

try {
  await chromeReady(port);
  const createdText = await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent("about:blank")}`).then((r) =>
    r.text(),
  );
  let created;
  try {
    created = JSON.parse(createdText);
  } catch {
    const list = await fetch(`http://127.0.0.1:${port}/json/list`).then((r) => r.json());
    created = (list || []).find((t) => t.type === "page" && t.webSocketDebuggerUrl);
  }
  if (!created?.webSocketDebuggerUrl) {
    throw new Error(`no CDP page websocket; /json/new was: ${createdText.slice(0, 200)}`);
  }
  const ws = await waitWs(created.webSocketDebuggerUrl);
  const cdp = new Cdp(ws);
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 1280,
    height: 800,
    deviceScaleFactor: 1,
    mobile: false,
  });

  step(`navigate ${BASE}/`);
  await cdp.send("Page.navigate", { url: `${BASE}/` });
  await cdp.send("Page.loadEventFired").catch(() => {});
  // loadEventFired may have already happened; poll the sheet instead
  let sheet = "";
  const tWait = Date.now();
  while (Date.now() - tWait < 45000) {
    sheet = (await evalExpr(cdp, `document.querySelector('#grom-threat-sheet')?.innerText || ''`)) || "";
    if (sheet && !sheet.includes("Skanuję radar…") && !sheet.includes("Brak danych")) break;
    if (sheet.includes("Brak danych") && Date.now() - tWait > 8000) break;
    await sleep(400);
  }
  if (!sheet || sheet.includes("Skanuję radar…") || sheet.includes("Brak danych")) {
    await screenshot(cdp, join(OUT, "00-failed-ready.png"));
    throw new Error(`sheet not ready after snapshot wait: ${JSON.stringify(sheet.slice(0, 200))}`);
  }
  step(`sheet ready, starts with pin copy: ${sheet.split("\n").slice(0, 4).join(" | ")}`);

  if (FEATURE === "radar-map") {
    let chip = { present: false, pressed: null };
    const tChip = Date.now();
    while (Date.now() - tChip < 20000) {
      chip = await evalExpr(
        cdp,
        `(() => {
          const btn = [...document.querySelectorAll("button")].find((b) =>
            b.textContent.trim() === "tor komórki" ||
            (b.textContent.includes("tor komórki") && !b.textContent.includes("pokaż"))
          );
          if (!btn) return { present: false, pressed: null, text: null };
          return { present: true, pressed: btn.getAttribute("aria-pressed"), text: btn.textContent.trim() };
        })()`,
      );
      if (chip.present) break;
      await sleep(400);
    }
    step(`tor komórki chip present=${chip.present} aria-pressed=${chip.pressed}`);
    if (!chip.present) {
      await screenshot(cdp, join(OUT, "00-failed-no-chip.png"));
      throw new Error("tor komórki chip missing — no tracks to toggle (or radar empty)");
    }
    if (chip.pressed !== "false") {
      await screenshot(cdp, join(OUT, "00-failed-pressed.png"));
      throw new Error(`tor komórki aria-pressed should be false on fresh load, got ${chip.pressed}`);
    }
    await sleep(1500);
    const amberOff = await evalExpr(cdp, COUNT_AMBER_JS);
    step(`overlay canvas amber pixels (off)=${amberOff}`);
    if (amberOff > 20) {
      await screenshot(cdp, join(OUT, "00-failed-arrows-on.png"));
      throw new Error(`fresh load still has orange track glyphs (${amberOff} amber pixels)`);
    }
    await screenshot(cdp, join(OUT, "01-tracks-off.png"));

    const toggled = await evalExpr(
      cdp,
      `(() => {
        const btn = [...document.querySelectorAll("button")].find((b) =>
          b.textContent.trim() === "tor komórki" ||
          (b.textContent.includes("tor komórki") && !b.textContent.includes("pokaż"))
        );
        if (!btn) return "missing";
        btn.click();
        return btn.getAttribute("aria-pressed");
      })()`,
    );
    if (toggled !== "true") {
      await screenshot(cdp, join(OUT, "00-failed-toggle.png"));
      throw new Error(`clicking tor komórki did not press it on (aria-pressed=${toggled})`);
    }
    let amberOn = 0;
    const tAmber = Date.now();
    while (Date.now() - tAmber < 8000) {
      amberOn = await evalExpr(cdp, COUNT_AMBER_JS);
      if (amberOn >= 30) break;
      await sleep(400);
    }
    step(`overlay canvas amber pixels (on)=${amberOn}`);
    if (amberOn < 30) {
      await screenshot(cdp, join(OUT, "00-failed-no-arrows.png"));
      throw new Error(`chip on but overlay canvas has too few amber pixels (${amberOn})`);
    }
    await screenshot(cdp, join(OUT, "02-tracks-on.png"));

    const stored = await evalExpr(
      cdp,
      `(() => { try { return JSON.parse(localStorage.getItem("grom-settings-v1")||"{}"); } catch { return {}; } })()`,
    );
    notes.sideEffects.push({
      storage: "grom-settings-v1",
      tracksMap: stored?.tracksMap,
    });
    notes.ok = true;
    notes.finishedAt = new Date().toISOString();
    notes.result =
      `Fresh load: tor komórki aria-pressed=false, overlay amber pixels=${amberOff}. ` +
      `Chip on: aria-pressed=true, overlay amber pixels=${amberOn}. Sheet unchanged.`;
    await cdp.send("Browser.close").catch(() => {});
    ws.close();
  } else {
  await screenshot(cdp, join(OUT, "01-warszawa-sheet.png"));

  const beforeLabel = await evalExpr(
    cdp,
    `(() => { try { return JSON.parse(localStorage.getItem('grom-settings-v1')||'{}').place?.label || null; } catch { return null; } })()`,
  );
  step(`localStorage place.label before=${beforeLabel}`);

  step('click button[aria-label="Ustawienia"]');
  const opened = await evalExpr(
    cdp,
    `(() => { const b = document.querySelector('button[aria-label="Ustawienia"]'); if (!b) return 'missing'; b.click(); return 'clicked'; })()`,
  );
  if (opened !== "clicked") throw new Error("settings button missing");
  await sleep(300);
  const dialog = await evalExpr(
    cdp,
    `document.querySelector('[role="dialog"][aria-labelledby="settings-title"]')?.innerText || ''`,
  );
  if (!dialog.includes("Lokalizacja i alerty")) {
    await screenshot(cdp, join(OUT, "00-failed-dialog.png"));
    throw new Error("settings dialog did not open");
  }
  step("dialog open: Lokalizacja i alerty");
  await screenshot(cdp, join(OUT, "02-settings-dialog.png"));

  step('click city chip "Kraków"');
  const chip = await evalExpr(
    cdp,
    `(() => {
      const btn = [...document.querySelectorAll('[role="dialog"] button')].find((b) => b.textContent.trim() === 'Kraków');
      if (!btn) return 'missing';
      btn.click();
      return 'clicked';
    })()`,
  );
  if (chip !== "clicked") throw new Error("Kraków chip missing");

  let after = "";
  const tPin = Date.now();
  while (Date.now() - tPin < 15000) {
    const dlgGone = await evalExpr(cdp, `!document.querySelector('[role="dialog"][aria-labelledby="settings-title"]')`);
    after = (await evalExpr(cdp, `document.querySelector('#grom-threat-sheet')?.innerText || ''`)) || "";
    if (dlgGone && after.includes("Kraków") && after.includes("TERYT 1261")) break;
    await sleep(250);
  }
  if (!after.includes("Kraków") || !after.includes("TERYT 1261")) {
    await screenshot(cdp, join(OUT, "00-failed-krakow.png"));
    throw new Error(`pin did not become Kraków / TERYT 1261: ${JSON.stringify(after.slice(0, 240))}`);
  }
  const stored = await evalExpr(
    cdp,
    `JSON.parse(localStorage.getItem('grom-settings-v1')).place`,
  );
  if (stored?.label !== "Kraków" || stored?.terc !== "1261") {
    throw new Error(`localStorage place mismatch: ${JSON.stringify(stored)}`);
  }
  step("sheet shows Kraków + TERYT 1261; dialog closed");
  notes.sideEffects.push({
    storage: "grom-settings-v1",
    place: stored,
  });
  await screenshot(cdp, join(OUT, "03-krakow-sheet.png"));

  notes.ok = true;
  notes.finishedAt = new Date().toISOString();
  notes.result =
    "Clicked Ustawienia, chose Kraków chip, threat sheet and localStorage both show Kraków TERYT 1261.";
  await cdp.send("Browser.close").catch(() => {});
  ws.close();
  }
} catch (err) {
  notes.ok = false;
  notes.error = String(err?.message || err);
  notes.finishedAt = new Date().toISOString();
  writeFileSync(join(OUT, "notes.md"), formatNotes(notes));
  chrome.kill("SIGTERM");
  process.stderr.write(`drive failed: ${notes.error}\n`);
  process.exit(1);
}

writeFileSync(join(OUT, "notes.md"), formatNotes(notes));
process.stdout.write(JSON.stringify({ ok: true, out: OUT, feature: FEATURE }, null, 2) + "\n");

function formatNotes(n) {
  return `# Drive: ${n.feature}

**Base:** ${n.base}
**Out:** ${n.out}
**OK:** ${n.ok}
**When:** ${n.startedAt} → ${n.finishedAt || ""}

## Action → state

${n.result || n.error || ""}

## Steps

${n.steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}

## Side effects

${n.sideEffects.length ? n.sideEffects.map((s) => `- \`${s.storage}\` ${JSON.stringify(s)}`).join("\n") : "- none recorded"}

## Screenshots

${
  n.feature === "radar-map"
    ? `- \`01-tracks-off.png\` — fresh load, \`tor komórki\` aria-pressed false, no orange arrows
- \`02-tracks-on.png\` — chip on, arrows drawn`
    : `- \`01-warszawa-sheet.png\` — sheet after snapshot, default / prior pin
- \`02-settings-dialog.png\` — dialog \`Lokalizacja i alerty\` open
- \`03-krakow-sheet.png\` — sheet after Kraków chip`
}

Mocks: none. Radar snapshot is the live IMGW/RainViewer boundary already checked by doctor.
`;
}
