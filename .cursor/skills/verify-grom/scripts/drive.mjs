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
  process.stdout.write(`drive.mjs --feature location-pin|radar-map|pin-alerts|nowcast-threat-sheet [--base URL] [--out DIR] [--viewport WxH]

Features: location-pin, radar-map, pin-alerts, nowcast-threat-sheet
Viewport: 1280x800 by default; nowcast-threat-sheet drives the phone sheet at 390x844.
--pin "Kraków,Gdańsk": nowcast-threat-sheet only. Walks Ustawienia → city chip and stops at
  the first pin whose level chip is not CZYSTO, so peek is captured under live rain.
Chrome: system google-chrome / google-chrome-stable. User-data-dir under ${RUN_DIR}/chrome-profile.
`);
  process.exit(0);
}

const FEATURE = arg("--feature", "location-pin");
const BASE = (arg("--base", process.env.BASE || "http://127.0.0.1:8080")).replace(/\/$/, "");
const runId = new Date().toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 15);
const OUT = arg("--out", join(ROOT, ".cursor/skills/verify-grom/evidence", runId));

const FEATURES = ["location-pin", "radar-map", "pin-alerts", "nowcast-threat-sheet"];
if (!FEATURES.includes(FEATURE)) {
  console.error(`Unknown feature '${FEATURE}'. Shipped drivers: ${FEATURES.join(", ")}`);
  process.exit(2);
}

/** The peek card only exists below sm (640px), so the sheet feature drives a phone. */
const DEFAULT_VIEWPORT = FEATURE === "nowcast-threat-sheet" ? "390x844" : "1280x800";
const viewportArg = arg("--viewport", DEFAULT_VIEWPORT);
const vp = /^(\d+)x(\d+)$/.exec(viewportArg);
if (!vp) {
  console.error(`--viewport must look like 390x844, got '${viewportArg}'`);
  process.exit(2);
}
const VIEWPORT = { width: Number(vp[1]), height: Number(vp[2]) };
const PHONE = VIEWPORT.width < 640;
const PINS = arg("--pin", "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

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

const STATUS_ROW_RE =
  /(?:Radar (?:\d{1,2}:\d{2} · \d+ min(?: · alert wstrzymany)?|✕) · IMGW [✓✕] · wyładowania [✓✕]|Bez sieci(?: · ostatni radar \d{1,2}:\d{2})?(?: · alert wstrzymany)?)/;
const AMBER_OUTAGE_SENTENCES = [
  "Wyładowania chwilowo niedostępne",
  "Ostrzeżenia IMGW chwilowo niedostępne",
];

function hasAmberOutageSentences(text) {
  return AMBER_OUTAGE_SENTENCES.some((s) => text.includes(s));
}

function quoteStatusRow(text) {
  const m = text.match(STATUS_ROW_RE);
  return m ? m[0] : null;
}

const CLOCK_TICK_RE = /^\d{2}:\d{2}$/;
const TIMELINE_ARIA_RE = /^(Opad od \d{2}:\d{2} do \d{2}:\d{2}, najsilniej ok\. \d{2}:\d{2}|Brak opadu od \d{2}:\d{2} do \d{2}:\d{2})$/;

/**
 * The 3-second read must be unobstructed: hit-test the center of the headline,
 * the place line and the Za ile hero, and require the topmost node at that point
 * to live inside #grom-threat-sheet. Catches floating chrome (map chips, banner,
 * slider) drifting over the card's first rows — a bounding-box probe never does.
 */
const OBSTRUCTION_JS = `(() => {
  const sheet = document.querySelector("#grom-threat-sheet");
  if (!sheet) return null;
  const visible = (el) => {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    const st = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && st.visibility !== "hidden" && st.display !== "none";
  };
  const h2 = [...sheet.querySelectorAll("h2")].find(visible);
  const placeRow = h2?.parentElement?.nextElementSibling;
  const place = placeRow ? [...placeRow.querySelectorAll("p")].find(visible) : null;
  const zaIleDt = [...sheet.querySelectorAll("dt")].find(
    (dt) => dt.textContent.trim() === "Za ile" && visible(dt),
  );
  const zaIle = zaIleDt ? zaIleDt.parentElement.querySelector("dd") : null;
  const hit = (el) => {
    if (!el || !visible(el)) return { found: false };
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const at = document.elementFromPoint(cx, cy);
    return {
      found: true,
      point: [Math.round(cx), Math.round(cy)],
      inside: at ? sheet.contains(at) : false,
      hit: at ? at.tagName : null,
      text: el.textContent.replace(/\\s+/g, " ").trim().slice(0, 40),
    };
  };
  return { headline: hit(h2), place: hit(place), zaIle: hit(zaIle) };
})()`;

/**
 * Rendered-string lock for the strip rows. The extras gate must never collapse a
 * flex row to block (tailwind-merge drops "flex" for a bare "hidden"): that glued
 * "90 minz ruchu echa" and "ulewny >10nic w oknie 90 min" on desktop.
 */
const STRIP_ROWS_JS = `(() => {
  const sheet = document.querySelector("#grom-threat-sheet");
  if (!sheet) return null;
  const rowFor = (needle) => {
    const span = [...sheet.querySelectorAll("span")].find((s) =>
      (s.textContent || "").includes(needle),
    );
    const row = span ? span.closest("div") : null;
    if (!row) return null;
    const r = row.getBoundingClientRect();
    const st = getComputedStyle(row);
    const visible = r.height > 0 && st.display !== "none" && st.visibility !== "hidden";
    return {
      visible,
      display: st.display,
      text: (row.innerText || "").replace(/\\s+/g, " ").trim(),
    };
  };
  return {
    labelRow: rowFor("Opad nad pinezką"),
    legendRow: rowFor("ulewny"),
    glued: /90 minz ruchu echa|>10nic w oknie/.test(sheet.innerText),
  };
})()`;

async function assertUnobstructed(cdp, OUT, label, file = "obstruction.json") {
  const ob = await evalExpr(cdp, OBSTRUCTION_JS);
  if (!ob) return;
  writeFileSync(
    join(OUT, file),
    JSON.stringify({ when: new Date().toISOString(), label, ...ob }, null, 2),
  );
  for (const [key, res] of Object.entries(ob)) {
    if (!res.found || !res.inside) {
      await screenshot(cdp, join(OUT, "00-failed-obstruction.png"));
      throw new Error(
        `${label}: ${key} is not the topmost node at its own center — the 3-second read is covered: ${JSON.stringify(res)}`,
      );
    }
  }
  step(
    `${label}: headline/place/Za ile hit-test clean (centers resolve inside #grom-threat-sheet)`,
  );
}

async function assertStripRows(cdp, OUT, label) {
  const rows = await evalExpr(cdp, STRIP_ROWS_JS);
  if (!rows) return;
  writeFileSync(
    join(OUT, "strip-rows.json"),
    JSON.stringify({ when: new Date().toISOString(), ...rows }, null, 2),
  );
  if (rows.glued) {
    await screenshot(cdp, join(OUT, "00-failed-strip-glue.png"));
    throw new Error(`${label}: strip rows glued: ${JSON.stringify(rows)}`);
  }
  for (const [key, row] of Object.entries({ labelRow: rows.labelRow, legendRow: rows.legendRow })) {
    if (row?.visible && row.display !== "flex") {
      await screenshot(cdp, join(OUT, "00-failed-strip-glue.png"));
      throw new Error(`${label}: ${key} renders as ${row.display}, not flex: ${JSON.stringify(row)}`);
    }
  }
}

const TICKS_JS = `(() => {
  const sheet = document.querySelector("#grom-threat-sheet");
  if (!sheet) return null;
  const img = sheet.querySelector('[role="img"]');
  const axis = sheet.querySelector("[data-timeline-axis]");
  const ticks = [...(axis?.querySelectorAll("span") || [])].map((s) => s.textContent.trim());
  return {
    present: !!(img || axis),
    aria: img?.getAttribute("aria-label") || null,
    ticks,
    hasNowCursor: !!sheet.querySelector("[data-now-cursor]"),
  };
})()`;

function ticksLookLikeMinutes(ticks) {
  return ticks.some((t) => /min|teraz/i.test(t) || !CLOCK_TICK_RE.test(t));
}

/** Sheet geometry + the peek card's own facts: hero size, clipping, nested scrollers. */
const SHEET_STATE_JS = `(() => {
  const sheet = document.querySelector("#grom-threat-sheet");
  if (!sheet) return null;
  const handle = sheet.querySelector('button[aria-controls="grom-threat-sheet"]');
  const handleVisible = !!handle && getComputedStyle(handle).display !== "none";
  const ariaExpanded = handle ? handle.getAttribute("aria-expanded") : null;
  const peek = handleVisible && ariaExpanded === "false" ? handle : null;
  const px = (el) => (el ? Math.round(parseFloat(getComputedStyle(el).fontSize)) : null);
  const valueFor = (label) => {
    for (const dt of sheet.querySelectorAll("dt")) {
      if (dt.textContent.trim() !== label) continue;
      const dd = dt.parentElement.querySelector("dd");
      if (dd && dd.offsetParent !== null) return { text: dd.textContent.trim(), px: px(dd) };
    }
    return null;
  };
  const nestedScrollers = peek
    ? [...peek.querySelectorAll("*")].filter(
        (el) =>
          /auto|scroll/.test(getComputedStyle(el).overflowY) &&
          el.scrollHeight - el.clientHeight > 2,
      ).length
    : null;
  const scroller = [...sheet.querySelectorAll(".overflow-y-auto")].find((el) => el.clientHeight > 0);
  const chip = [...sheet.querySelectorAll("span")]
    .map((s) => (s.innerText || "").trim())
    .find((t) => /^(TERAZ|ZARAZ|BLISKO|CZYSTO)$/.test(t));
  return {
    peeking: !!peek,
    handleVisible,
    ariaExpanded,
    detentClass: [...sheet.classList].filter((c) => c.startsWith("max-h-")).join(" "),
    sheetHeight: Math.round(sheet.getBoundingClientRect().height),
    sheetClippedPx: sheet.scrollHeight - sheet.clientHeight,
    expandedOverflowPx: scroller ? scroller.scrollHeight - scroller.clientHeight : null,
    viewportHeight: window.innerHeight,
    peekNestedScrollers: nestedScrollers,
    peekNestedButtons: peek ? peek.querySelectorAll("button").length : null,
    peekText: peek ? peek.innerText.replace(/\\s+/g, " ").trim() : null,
    zaIle: valueFor("Za ile"),
    szansa: valueFor("Szansa"),
    chip: chip || null,
    sheetText: sheet.innerText.replace(/\\s+/g, " ").trim(),
  };
})()`;

const ENGLISH_LEAK_RE = /\bNOW\b|\bIMMINENT\b|\bNEARBY\b|\bETA\b|TERYT|\bECHO\b/;

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
  // MapLibre needs WebGL2 or it throws in a loop and can wedge the renderer.
  ...(FEATURE === "radar-map" || FEATURE === "nowcast-threat-sheet"
    ? ["--use-angle=swiftshader"]
    : []),
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
    width: VIEWPORT.width,
    height: VIEWPORT.height,
    deviceScaleFactor: PHONE ? 2 : 1,
    mobile: PHONE,
  });
  step(`viewport ${VIEWPORT.width}x${VIEWPORT.height}${PHONE ? " (phone)" : ""}`);

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
  if (/TERYT/i.test(sheet)) {
    await screenshot(cdp, join(OUT, "00-failed-teryt-leak.png"));
    throw new Error(`sheet leaked TERYT: ${JSON.stringify(sheet.slice(0, 240))}`);
  }
  const TRIO_JS = `(() => {
    const el = document.querySelector("#grom-threat-sheet");
    if (!el) return { labels: [], stats: [], sheetHasETA: false };
    const stats = [...el.querySelectorAll("dl div")].map((row) => ({
      label: row.querySelector("dt")?.textContent?.trim() ?? "",
      shown: row.querySelector("dt")?.innerText?.trim() ?? "",
      value: row.querySelector("dd")?.textContent?.trim() ?? "",
    }));
    return {
      labels: [...new Set(stats.map((s) => s.label))],
      stats,
      sheetHasETA: /\\bETA\\b/.test(el.innerText),
    };
  })()`;
  const trio = await evalExpr(cdp, TRIO_JS);
  writeFileSync(join(OUT, "trio.json"), JSON.stringify({ when: new Date().toISOString(), pin: "Warszawa", ...trio }, null, 2));
  if (trio.labels.includes("ETA") || trio.sheetHasETA) {
    await screenshot(cdp, join(OUT, "00-failed-eta-label.png"));
    throw new Error(`sheet still shows ETA: ${JSON.stringify(trio)}`);
  }
  // A phone at peek has the answer but not the expanded block, so the trio-label
  // and status-row checks belong to the expanded sheet only.
  let state0 = await evalExpr(cdp, SHEET_STATE_JS);
  const collapsed = Boolean(state0?.peeking);
  if (!collapsed) {
    // The mobile auto-expand (imminent/now → half) can land between the readiness
    // poll and the state read; re-read so checks below see the expanded sheet.
    sheet = (await evalExpr(cdp, `document.querySelector('#grom-threat-sheet')?.innerText || ''`)) || sheet;
  }
  if (collapsed) {
    step(`sheet is collapsed (${state0.detentClass}); expanded-only checks deferred`);
    if (!state0.zaIle || !state0.szansa) {
      await screenshot(cdp, join(OUT, "00-failed-za-ile.png"));
      throw new Error(`peek missing Za ile / Szansa: ${JSON.stringify(state0)}`);
    }
  } else if (!trio.labels.includes("Za ile") || !trio.labels.includes("Szansa")) {
    await screenshot(cdp, join(OUT, "00-failed-za-ile.png"));
    throw new Error(`sheet missing Za ile / Szansa: ${JSON.stringify(trio.labels)}`);
  }
  const statusRow = collapsed ? null : quoteStatusRow(sheet);
  writeFileSync(
    join(OUT, "status-row.json"),
    JSON.stringify({ when: new Date().toISOString(), pin: "Warszawa", statusRow, sheetHasAmberSentences: hasAmberOutageSentences(sheet) }, null, 2),
  );
  if (hasAmberOutageSentences(sheet)) {
    await screenshot(cdp, join(OUT, "00-failed-amber-sentences.png"));
    throw new Error(`sheet still has amber outage sentences: ${JSON.stringify(sheet.slice(0, 400))}`);
  }
  if (!statusRow && !collapsed) {
    await screenshot(cdp, join(OUT, "00-failed-status-row.png"));
    throw new Error(`sheet missing status row: ${JSON.stringify(sheet.slice(0, 400))}`);
  }
  await assertUnobstructed(cdp, OUT, "sheet ready");
  await assertStripRows(cdp, OUT, "sheet ready");
  const ticks = await evalExpr(cdp, TICKS_JS);
  if (ticks?.present) {
    writeFileSync(join(OUT, "ticks.json"), JSON.stringify({ when: new Date().toISOString(), pin: "Warszawa", ...ticks }, null, 2));
    if (!ticks.aria || ticks.aria === "Oś czasu opadu" || !TIMELINE_ARIA_RE.test(ticks.aria)) {
      await screenshot(cdp, join(OUT, "00-failed-timeline-aria.png"));
      throw new Error(`timeline aria is mute or not a clock sentence: ${JSON.stringify(ticks)}`);
    }
    if (!ticks.ticks?.length || ticksLookLikeMinutes(ticks.ticks)) {
      await screenshot(cdp, join(OUT, "00-failed-timeline-ticks.png"));
      throw new Error(`timeline ticks are not HH:MM Warsaw clocks: ${JSON.stringify(ticks)}`);
    }
    if (!ticks.hasNowCursor) {
      await screenshot(cdp, join(OUT, "00-failed-now-cursor.png"));
      throw new Error(`now-cursor missing on the 90-min strip: ${JSON.stringify(ticks)}`);
    }
    step(`timeline ticks: ${ticks.ticks.join(" · ")}`);
    step(`timeline aria: ${ticks.aria}`);
  } else {
    step("timeline not on sheet (no 90-min strip)");
  }
  step(`trio labels: ${trio.labels.join(" · ")}`);
  step(`status row: ${statusRow}`);
  step(`sheet ready, starts with pin copy: ${sheet.split("\n").slice(0, 4).join(" | ")}`);

  const CHROME_JS = `(() => {
    const box = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const st = getComputedStyle(el);
      return {
        w: Math.round(r.width),
        h: Math.round(r.height),
        top: Math.round(r.top),
        bottom: Math.round(r.bottom),
        visible: r.width > 0 && r.height > 0 && st.visibility !== "hidden" && st.display !== "none" && r.bottom > 0 && r.top < window.innerHeight,
        text: (el.getAttribute("aria-label") || el.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 80),
      };
    };
    return {
      zoomIn: box(document.querySelector('button[aria-label="Przybliż"]')),
      zoomOut: box(document.querySelector('button[aria-label="Oddal"]')),
      locate: box(document.querySelector('#grom-map-chrome button[aria-label="Wybierz lokalizację"]')),
      legend: box(document.querySelector('[aria-label="Legenda opadu"]')),
      credit: box(document.querySelector("#grom-map-credit")),
    };
  })()`;
  const mapChrome = await evalExpr(cdp, CHROME_JS);
  writeFileSync(join(OUT, "map-chrome.json"), JSON.stringify({ when: new Date().toISOString(), ...mapChrome }, null, 2));
  const chromeMissing = ["zoomIn", "zoomOut", "locate", "legend", "credit"].filter((k) => !mapChrome?.[k]?.visible);
  if (chromeMissing.length) {
    await screenshot(cdp, join(OUT, "00-failed-map-chrome.png"));
    throw new Error(`map chrome not on screen: ${chromeMissing.join(", ")} ${JSON.stringify(mapChrome)}`);
  }
  step(
    `map chrome on screen: zoom ${mapChrome.zoomIn.text}/${mapChrome.zoomOut.text}, locate, legend, credit "${mapChrome.credit.text}"`,
  );

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

    const clicked = await evalExpr(
      cdp,
      `(() => {
        const btn = [...document.querySelectorAll("button")].find((b) =>
          b.textContent.trim() === "tor komórki" ||
          (b.textContent.includes("tor komórki") && !b.textContent.includes("pokaż"))
        );
        if (!btn) return "missing";
        btn.click();
        return "clicked";
      })()`,
    );
    if (clicked !== "clicked") {
      await screenshot(cdp, join(OUT, "00-failed-toggle.png"));
      throw new Error("tor komórki chip missing at click");
    }
    let toggled = null;
    const tToggle = Date.now();
    while (Date.now() - tToggle < 4000) {
      toggled = await evalExpr(
        cdp,
        `(() => {
          const btn = [...document.querySelectorAll("button")].find((b) =>
            b.textContent.trim() === "tor komórki" ||
            (b.textContent.includes("tor komórki") && !b.textContent.includes("pokaż"))
          );
          return btn ? btn.getAttribute("aria-pressed") : null;
        })()`,
      );
      if (toggled === "true") break;
      await sleep(150);
    }
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
  } else if (FEATURE === "pin-alerts") {
    await screenshot(cdp, join(OUT, "01-sheet-before.png"));
    const sheetBefore = await evalExpr(cdp, `document.querySelector('#grom-threat-sheet')?.innerText || ''`);
    const sheetHasStats = /szansa/i.test(sheetBefore) && /za ile/i.test(sheetBefore);
    if (!sheetBefore.includes("Warszawa") || !sheetHasStats) {
      throw new Error(`sheet missing Warszawa / Szansa / Za ile before alerts: ${JSON.stringify(sheetBefore.slice(0, 400))}`);
    }

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
    if (!dialog.includes("Lokalizacja i alerty") || !dialog.includes("Alerty na pinezkę")) {
      await screenshot(cdp, join(OUT, "00-failed-dialog.png"));
      throw new Error("settings dialog did not open");
    }
    step("dialog open: Lokalizacja i alerty");
    await screenshot(cdp, join(OUT, "02-settings-dialog.png"));

    const toggleState = await evalExpr(
      cdp,
      `(() => {
        const dlg = document.querySelector('[role="dialog"][aria-labelledby="settings-title"]');
        const btn = [...(dlg?.querySelectorAll("button") || [])].find((b) => {
          const t = b.textContent.replace(/\\s+/g, " ").trim();
          return t === "Włącz" || t === "Włączone";
        });
        if (!btn) return { state: "missing" };
        const text = btn.textContent.replace(/\\s+/g, " ").trim();
        if (text === "Włącz") btn.click();
        return { state: text };
      })()`,
    );
    if (toggleState.state === "missing") throw new Error("Włącz / Włączone toggle missing");
    step(`alerts toggle was ${toggleState.state}`);

    let testReady = false;
    const tEnable = Date.now();
    while (Date.now() - tEnable < 4000) {
      testReady = await evalExpr(
        cdp,
        `(() => {
          const dlg = document.querySelector('[role="dialog"][aria-labelledby="settings-title"]');
          return !!(dlg && [...dlg.querySelectorAll("button")].find((b) => b.textContent.trim() === "Testuj alert"));
        })()`,
      );
      if (testReady) break;
      await sleep(150);
    }
    if (!testReady) {
      await screenshot(cdp, join(OUT, "00-failed-enable.png"));
      throw new Error("Testuj alert did not appear after enabling");
    }

    step('click "Testuj alert"');
    const tested = await evalExpr(
      cdp,
      `(() => {
        const dlg = document.querySelector('[role="dialog"][aria-labelledby="settings-title"]');
        const btn = [...(dlg?.querySelectorAll("button") || [])].find((b) => b.textContent.trim() === "Testuj alert");
        if (!btn) return "missing";
        btn.click();
        return "clicked";
      })()`,
    );
    if (tested !== "clicked") throw new Error("Testuj alert missing");

    let banner = "";
    const tBanner = Date.now();
    while (Date.now() - tBanner < 4000) {
      banner = (await evalExpr(
        cdp,
        `document.querySelector('[role="status"][aria-live="assertive"]')?.innerText || ''`,
      )) || "";
      if (banner.includes("Deszcz za ok. 18 min")) break;
      await sleep(150);
    }
    if (!banner.includes("Deszcz za ok. 18 min")) {
      await screenshot(cdp, join(OUT, "00-failed-banner.png"));
      throw new Error(`test banner missing title: ${JSON.stringify(banner.slice(0, 240))}`);
    }
    if (!banner.includes("Warszawa")) {
      await screenshot(cdp, join(OUT, "00-failed-banner.png"));
      throw new Error(`test banner missing pin label: ${JSON.stringify(banner.slice(0, 240))}`);
    }
    step("banner: Deszcz za ok. 18 min · Warszawa");
    await screenshot(cdp, join(OUT, "03-test-banner.png"));

    step('click button[aria-label="Zamknij alert"]');
    const dismissed = await evalExpr(
      cdp,
      `(() => { const b = document.querySelector('button[aria-label="Zamknij alert"]'); if (!b) return 'missing'; b.click(); return 'clicked'; })()`,
    );
    if (dismissed !== "clicked") throw new Error("Zamknij alert missing");
    await sleep(250);
    const bannerGone = await evalExpr(
      cdp,
      `!document.querySelector('[role="status"][aria-live="assertive"]')`,
    );
    if (!bannerGone) {
      await screenshot(cdp, join(OUT, "00-failed-dismiss.png"));
      throw new Error("banner still present after Zamknij alert");
    }

    const logText = await evalExpr(
      cdp,
      `document.querySelector('[role="dialog"][aria-labelledby="settings-title"]')?.innerText || ''`,
    );
    if (!logText.includes("Ostatnie alerty") || !logText.includes("Deszcz za ok. 18 min")) {
      await screenshot(cdp, join(OUT, "00-failed-log.png"));
      throw new Error(`Ostatnie alerty missing test title: ${JSON.stringify(logText.slice(0, 300))}`);
    }

    const stored = await evalExpr(
      cdp,
      `(() => { try { return JSON.parse(localStorage.getItem("grom-alerts-v1") || "[]"); } catch { return []; } })()`,
    );
    if (!Array.isArray(stored) || stored[0]?.title !== "Deszcz za ok. 18 min") {
      throw new Error(`grom-alerts-v1[0].title mismatch: ${JSON.stringify(stored?.[0])}`);
    }
    notes.sideEffects.push({ storage: "grom-alerts-v1", title: stored[0].title });

    const closed = await evalExpr(
      cdp,
      `(() => { const b = document.querySelector('button[aria-label="Zamknij"]'); if (!b) return 'missing'; b.click(); return 'clicked'; })()`,
    );
    if (closed !== "clicked") throw new Error("Zamknij dialog missing");
    await sleep(300);

    const sheetAfter = (await evalExpr(cdp, `document.querySelector('#grom-threat-sheet')?.innerText || ''`)) || "";
    const sheetAfterOk =
      sheetAfter.includes("Warszawa") && /szansa/i.test(sheetAfter) && /za ile/i.test(sheetAfter);
    if (!sheetAfterOk) {
      await screenshot(cdp, join(OUT, "00-failed-sheet.png"));
      throw new Error(`sheet broken after pin-alerts: ${JSON.stringify(sheetAfter.slice(0, 400))}`);
    }
    step("sheet still Warszawa + Szansa / Za ile after test alert");
    await screenshot(cdp, join(OUT, "04-sheet-after.png"));

    notes.ok = true;
    notes.finishedAt = new Date().toISOString();
    notes.result =
      "Enabled pin alerts, Testuj alert showed Deszcz za ok. 18 min for Warszawa, " +
      "dismissed banner, log + grom-alerts-v1 kept the title. Sheet still Warszawa / Szansa / Za ile.";
    await cdp.send("Browser.close").catch(() => {});
    ws.close();
  } else if (FEATURE === "nowcast-threat-sheet") {
    if (!PHONE) {
      throw new Error(`nowcast-threat-sheet drives the peek card; use a viewport below 640px (got ${VIEWPORT.width})`);
    }

    async function sheetState(label) {
      const s = await evalExpr(cdp, SHEET_STATE_JS);
      if (!s) throw new Error("#grom-threat-sheet missing");
      step(
        `${label}: detent ${s.detentClass} · height ${s.sheetHeight}px · aria-expanded=${s.ariaExpanded} · chip ${s.chip ?? "none"}`,
      );
      if (ENGLISH_LEAK_RE.test(s.sheetText)) {
        await screenshot(cdp, join(OUT, "00-failed-english-leak.png"));
        throw new Error(`sheet DOM leaked NOW/IMMINENT/ETA/TERYT/ECHO at ${label}: ${JSON.stringify(s.sheetText.slice(0, 400))}`);
      }
      if (!s.zaIle || !s.szansa) {
        await screenshot(cdp, join(OUT, `00-failed-numbers-${label}.png`));
        throw new Error(`sheet missing Za ile / Szansa at ${label}: ${JSON.stringify(s)}`);
      }
      if (!(s.zaIle.px > s.szansa.px)) {
        await screenshot(cdp, join(OUT, `00-failed-hero-${label}.png`));
        throw new Error(`Za ile is not the hero number at ${label}: ${JSON.stringify({ zaIle: s.zaIle, szansa: s.szansa })}`);
      }
      step(`${label}: Za ile ${s.zaIle.text} @${s.zaIle.px}px > Szansa ${s.szansa.text} @${s.szansa.px}px`);
      await assertUnobstructed(cdp, OUT, label, `obstruction-${label}.json`);
      return s;
    }

    async function checkPeek(s) {
      if (!s.detentClass.includes("max-h-[128px]")) {
        throw new Error(`peek is not the 128px detent: ${JSON.stringify(s.detentClass)}`);
      }
      if (s.peekNestedScrollers !== 0) {
        await screenshot(cdp, join(OUT, "00-failed-peek-scroller.png"));
        throw new Error(`peek has a nested scroller: ${JSON.stringify(s)}`);
      }
      if (s.peekNestedButtons !== 0) {
        await screenshot(cdp, join(OUT, "00-failed-peek-nested-button.png"));
        throw new Error(`peek has ${s.peekNestedButtons} button(s) inside the drag handle`);
      }
      if (s.sheetClippedPx > 2) {
        await screenshot(cdp, join(OUT, "00-failed-peek-clipped.png"));
        throw new Error(`peek content is clipped by ${s.sheetClippedPx}px inside 128px`);
      }
      step(`peek fits: clipped ${s.sheetClippedPx}px, nested scrollers ${s.peekNestedScrollers}, nested buttons ${s.peekNestedButtons}`);
      step(`peek text: ${s.peekText}`);
    }

    async function clickHandle() {
      const clicked = await evalExpr(
        cdp,
        `(() => {
          const b = document.querySelector('button[aria-controls="grom-threat-sheet"]');
          if (!b) return "missing";
          b.click();
          return "clicked";
        })()`,
      );
      if (clicked !== "clicked") throw new Error("sheet handle missing");
      await sleep(400);
    }

    /** Walk Ustawienia → city chip. Real user path; stops on the first pin with rain. */
    async function choosePin(label) {
      // SSR can already contain the resolved snapshot, so a "ready" sheet does not
      // prove hydration: the first tap on Ustawienia can land on a dead button.
      let dialogOpen = false;
      for (let attempt = 0; attempt < 8 && !dialogOpen; attempt += 1) {
        const opened = await evalExpr(
          cdp,
          `(() => { const b = document.querySelector('button[aria-label="Ustawienia"]'); if (!b) return "missing"; b.click(); return "clicked"; })()`,
        );
        if (opened !== "clicked") throw new Error("settings button missing");
        for (let i = 0; i < 4 && !dialogOpen; i += 1) {
          await sleep(250);
          dialogOpen = await evalExpr(
            cdp,
            `!!document.querySelector('[role="dialog"][aria-labelledby="settings-title"] button')`,
          );
        }
        if (!dialogOpen) step(`Ustawienia tap ${attempt + 1} did not open the dialog (hydration?)`);
      }
      const clicked = await evalExpr(
        cdp,
        `(() => {
          const btn = [...document.querySelectorAll('[role="dialog"] button')].find(
            (b) => b.textContent.trim() === ${JSON.stringify(label)},
          );
          if (!btn) return "missing";
          btn.click();
          return "clicked";
        })()`,
      );
      if (clicked !== "clicked") {
        // Only the first 12 CITIES get a chip; a missing one is a bad --pin, not a bug.
        const chips = await evalExpr(
          cdp,
          `[...document.querySelectorAll('[role="dialog"] button')].map((b) => b.textContent.trim())`,
        );
        step(`no city chip for ${label}; chips are ${JSON.stringify(chips)}`);
        await evalExpr(
          cdp,
          `(() => { const b = document.querySelector('button[aria-label="Zamknij"]'); if (b) b.click(); return true; })()`,
        );
        await sleep(300);
        return null;
      }
      const tPin = Date.now();
      while (Date.now() - tPin < 20000) {
        const txt = await evalExpr(cdp, `document.querySelector('#grom-threat-sheet')?.innerText || ''`);
        const gone = await evalExpr(cdp, `!document.querySelector('[role="dialog"][aria-labelledby="settings-title"]')`);
        if (gone && txt.includes(label) && !txt.includes("Skanuję radar…")) break;
        await sleep(300);
      }
      const s = await evalExpr(cdp, SHEET_STATE_JS);
      step(`pin ${label}: chip ${s?.chip ?? "none"} · ${String(s?.sheetText).slice(0, 90)}`);
      return s;
    }

    let pinLabel = null;
    let liveHero = null;
    for (const candidate of PINS) {
      const s = await choosePin(candidate);
      if (!s) continue;
      pinLabel = candidate;
      if (s.chip && s.chip !== "CZYSTO") {
        step(`stopping on ${candidate}: live level chip ${s.chip}`);
        liveHero = null;
        break;
      }
      // Second choice: a clear pin whose hero still has rain in the 90-min window.
      if (!liveHero && s.zaIle && s.zaIle.text !== "—" && s.zaIle.text !== "minie") {
        liveHero = candidate;
      }
    }
    if (liveHero && pinLabel !== liveHero) {
      step(`no live level chip; going back to ${liveHero}, the one pin with a real Za ile`);
      await choosePin(liveHero);
      pinLabel = liveHero;
    }
    if (PINS.length > 0 && !pinLabel) {
      throw new Error(`none of --pin ${JSON.stringify(PINS)} has a city chip in the dialog`);
    }
    pinLabel = pinLabel ?? (await evalExpr(
      cdp,
      `(() => { try { return JSON.parse(localStorage.getItem("grom-settings-v1") || "{}").place?.label || "Warszawa"; } catch { return "Warszawa"; } })()`,
    ));
    notes.sideEffects.push({ storage: "grom-settings-v1", pin: pinLabel });
    state0 = await evalExpr(cdp, SHEET_STATE_JS);

    let peekState = null;
    let halfState = null;
    let first = await sheetState(state0?.peeking ? "peek" : "auto-expanded");
    if (first.peeking) {
      peekState = first;
      await checkPeek(peekState);
      await screenshot(cdp, join(OUT, "01-peek-390x844.png"));
      step("tap the grab handle");
      await clickHandle();
      halfState = await sheetState("half");
    } else {
      halfState = first;
      await screenshot(cdp, join(OUT, "01-auto-expanded-390x844.png"));
      step("auto-expanded on a now/imminent pin; tap the handle back to peek");
      await clickHandle();
      peekState = await sheetState("peek");
      await checkPeek(peekState);
      await screenshot(cdp, join(OUT, "01-peek-390x844.png"));
      await clickHandle();
      halfState = await sheetState("half");
    }

    if (halfState.ariaExpanded !== "true") {
      await screenshot(cdp, join(OUT, "00-failed-expand.png"));
      throw new Error(`handle did not expand the sheet: aria-expanded=${halfState.ariaExpanded}`);
    }
    if (!halfState.detentClass.includes("max-h-[45dvh]")) {
      await screenshot(cdp, join(OUT, "00-failed-half-detent.png"));
      throw new Error(`expanded detent is not 45dvh: ${JSON.stringify(halfState.detentClass)}`);
    }
    const halfMax = Math.round(halfState.viewportHeight * 0.45) + 4;
    if (halfState.sheetHeight > halfMax) {
      await screenshot(cdp, join(OUT, "00-failed-half-height.png"));
      throw new Error(`half detent is ${halfState.sheetHeight}px, over 45dvh (${halfMax}px)`);
    }
    const halfStatus = quoteStatusRow(halfState.sheetText);
    if (!halfStatus) {
      await screenshot(cdp, join(OUT, "00-failed-half-status.png"));
      throw new Error(`half is missing the grey status row: ${JSON.stringify(halfState.sheetText.slice(0, 400))}`);
    }
    if (/Dane: IMGW-PIB|O danych/.test(halfState.sheetText)) {
      await screenshot(cdp, join(OUT, "00-failed-half-tail.png"));
      throw new Error(`half still prints the full-detent tail: ${JSON.stringify(halfState.sheetText.slice(0, 400))}`);
    }
    step(`half status row: ${halfStatus}`);
    step(`half text: ${halfState.sheetText.slice(0, 320)}`);
    await screenshot(cdp, join(OUT, "02-half-390x844.png"));

    const pinTicks = await evalExpr(cdp, TICKS_JS);
    writeFileSync(
      join(OUT, "peek.json"),
      JSON.stringify(
        {
          when: new Date().toISOString(),
          viewport: VIEWPORT,
          pin: pinLabel,
          peek: peekState,
          half: { ...halfState, statusRow: halfStatus },
          ticks: pinTicks,
        },
        null,
        2,
      ),
    );

    notes.ok = true;
    notes.finishedAt = new Date().toISOString();
    notes.result =
      `Peek at ${VIEWPORT.width}x${VIEWPORT.height}: ${peekState.detentClass}, ${peekState.sheetHeight}px, ` +
      `no nested scroller or button, Za ile ${peekState.zaIle.text} @${peekState.zaIle.px}px over Szansa ` +
      `${peekState.szansa.text} @${peekState.szansa.px}px, chip ${peekState.chip ?? "none"}. ` +
      `Handle tap → ${halfState.detentClass} at ${halfState.sheetHeight}px with the status row "${halfStatus}" ` +
      `and no Dane:/O danych tail. No NOW/IMMINENT/ETA/TERYT/ECHO in the sheet DOM.`;
    await cdp.send("Browser.close").catch(() => {});
    ws.close();
  } else {
  await screenshot(cdp, join(OUT, "01-warszawa-sheet.png"));
  await evalExpr(
    cdp,
    `(() => {
      const sheet = document.querySelector("#grom-threat-sheet");
      if (!sheet) return null;
      sheet.scrollTop = sheet.scrollHeight;
      for (const el of sheet.querySelectorAll(".overflow-y-auto")) el.scrollTop = el.scrollHeight;
      return sheet.scrollHeight;
    })()`,
  );
  await sleep(200);
  await screenshot(cdp, join(OUT, "01b-warszawa-status-row.png"));
  step("Warszawa sheet scrolled to status row");

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
  if (!dialog.includes("Miejsce") || !dialog.includes("Alerty")) {
    await screenshot(cdp, join(OUT, "00-failed-dialog.png"));
    throw new Error(`settings dialog missing Miejsce/Alerty split: ${JSON.stringify(dialog.slice(0, 240))}`);
  }
  const dialogA11y = await evalExpr(
    cdp,
    `(() => {
      const d = document.querySelector('[role="dialog"][aria-labelledby="settings-title"]');
      if (!d) return null;
      return { role: d.getAttribute("role"), ariaModal: d.getAttribute("aria-modal") };
    })()`,
  );
  if (dialogA11y?.ariaModal !== "true") {
    await screenshot(cdp, join(OUT, "00-failed-dialog.png"));
    throw new Error(`settings dialog missing aria-modal=true: ${JSON.stringify(dialogA11y)}`);
  }
  step(`dialog open: Lokalizacja i alerty · Miejsce · Alerty; aria-modal=${dialogA11y.ariaModal}`);
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
    if (dlgGone && after.includes("Kraków") && !/TERYT/i.test(after)) break;
    await sleep(250);
  }
  if (!after.includes("Kraków")) {
    await screenshot(cdp, join(OUT, "00-failed-krakow.png"));
    throw new Error(`pin did not become Kraków: ${JSON.stringify(after.slice(0, 240))}`);
  }
  if (/TERYT/i.test(after)) {
    await screenshot(cdp, join(OUT, "00-failed-teryt-leak.png"));
    throw new Error(`sheet leaked TERYT: ${JSON.stringify(after.slice(0, 240))}`);
  }
  const stored = await evalExpr(
    cdp,
    `JSON.parse(localStorage.getItem('grom-settings-v1')).place`,
  );
  if (stored?.label !== "Kraków" || stored?.terc !== "1261") {
    throw new Error(`localStorage place mismatch: ${JSON.stringify(stored)}`);
  }
  step("sheet shows Kraków (no TERYT); dialog closed");
  const trioKrakow = await evalExpr(cdp, TRIO_JS);
  writeFileSync(
    join(OUT, "trio.json"),
    JSON.stringify(
      { when: new Date().toISOString(), warszawa: trio, krakow: { pin: "Kraków", ...trioKrakow } },
      null,
      2,
    ),
  );
  if (trioKrakow.labels.includes("ETA") || trioKrakow.sheetHasETA) {
    await screenshot(cdp, join(OUT, "00-failed-eta-label.png"));
    throw new Error(`Kraków sheet still shows ETA: ${JSON.stringify(trioKrakow)}`);
  }
  const statusKrakow = quoteStatusRow(after);
  writeFileSync(
    join(OUT, "status-row.json"),
    JSON.stringify(
      {
        when: new Date().toISOString(),
        warszawa: statusRow,
        krakow: statusKrakow,
        sheetHasAmberSentences: hasAmberOutageSentences(after),
      },
      null,
      2,
    ),
  );
  if (hasAmberOutageSentences(after) || !statusKrakow) {
    await screenshot(cdp, join(OUT, "00-failed-status-row.png"));
    throw new Error(`Kraków sheet status row missing or amber sentences present: ${JSON.stringify(after.slice(0, 400))}`);
  }
  step(`Kraków status row: ${statusKrakow}`);
  const ticksKrakow = await evalExpr(cdp, TICKS_JS);
  if (ticksKrakow?.present) {
    writeFileSync(
      join(OUT, "ticks.json"),
      JSON.stringify(
        { when: new Date().toISOString(), warszawa: ticks, krakow: ticksKrakow },
        null,
        2,
      ),
    );
    if (!ticksKrakow.aria || !TIMELINE_ARIA_RE.test(ticksKrakow.aria) || ticksLookLikeMinutes(ticksKrakow.ticks || [])) {
      await screenshot(cdp, join(OUT, "00-failed-timeline-ticks.png"));
      throw new Error(`Kraków timeline ticks/aria not Warsaw clocks: ${JSON.stringify(ticksKrakow)}`);
    }
    step(`Kraków timeline ticks: ${ticksKrakow.ticks.join(" · ")}`);
    step(`Kraków timeline aria: ${ticksKrakow.aria}`);
  }
  notes.sideEffects.push({
    storage: "grom-settings-v1",
    place: stored,
  });
  await screenshot(cdp, join(OUT, "03-krakow-sheet.png"));
  await evalExpr(
    cdp,
    `(() => {
      const sheet = document.querySelector("#grom-threat-sheet");
      if (!sheet) return null;
      sheet.scrollTop = sheet.scrollHeight;
      for (const el of sheet.querySelectorAll(".overflow-y-auto")) el.scrollTop = el.scrollHeight;
      return sheet.scrollHeight;
    })()`,
  );
  await sleep(200);
  await screenshot(cdp, join(OUT, "03b-krakow-status-row.png"));

  notes.ok = true;
  notes.finishedAt = new Date().toISOString();
  notes.result =
    "Clicked Ustawienia, chose Kraków chip, threat sheet shows Kraków without TERYT; localStorage still has terc 1261.";
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
    : n.feature === "nowcast-threat-sheet"
      ? `- \`01-peek-390x844.png\` — phone peek: headline, chip, place, hero \`Za ile\`, \`Szansa\`, 90-min strip
- \`02-half-390x844.png\` — after the handle tap: \`Idzie od\` / \`Spodziewaj się\`, one caveat, status row
- \`peek.json\` — quoted detent, heights, font sizes, nested-scroller count, sheet text`
    : n.feature === "pin-alerts"
      ? `- \`01-sheet-before.png\` — sheet after snapshot, default pin
- \`02-settings-dialog.png\` — dialog \`Lokalizacja i alerty\` open
- \`03-test-banner.png\` — \`Testuj alert\` banner
- \`04-sheet-after.png\` — dialog closed, sheet unchanged`
      : `- \`01-warszawa-sheet.png\` — sheet after snapshot, default / prior pin
- \`01b-warszawa-status-row.png\` — sheet scrolled to the grey status row
- \`02-settings-dialog.png\` — dialog \`Lokalizacja i alerty\` open with \`Miejsce\` / \`Alerty\`
- \`03-krakow-sheet.png\` — sheet after Kraków chip
- \`03b-krakow-status-row.png\` — Kraków sheet scrolled to the status row`
}

Mocks: none. Radar snapshot is the live IMGW/RainViewer boundary already checked by doctor.
`;
}
