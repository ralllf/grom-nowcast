import assert from "node:assert/strict";
import test from "node:test";
import {
  NEAR_CELL_KM,
  PERUN_NO_STRIKES,
  PERUN_UNAVAILABLE,
  STRIKE_WINDOW_MS,
  csvTimeMs,
  fetchPerunPolska,
  isHtmlBounce,
  lightningCaption,
  listPerunCsvNames,
  parsePerunCsv,
  strikeNearCell,
  strikeOpacity,
} from "./perun.ts";

const NOW = Date.UTC(2026, 7, 31, 12, 51, 0);

const SAMPLE_CSV = `czas;szerokosc;dlugosc;natezenie;typ
2026-08-31 12:50:01;50.061;19.937;-14.2;CG
2026-08-31 12:50:44;51.102;17.033;8.1;IC
`;

test("parsePerunCsv reads lat/lon/time from a semicolon PERUN_Polska CSV", () => {
  const strikes = parsePerunCsv(SAMPLE_CSV, { fallbackTimeMs: NOW });
  assert.equal(strikes.length, 2);
  assert.equal(strikes[0]!.lat, 50.061);
  assert.equal(strikes[0]!.lon, 19.937);
  assert.equal(strikes[0]!.timeMs, Date.UTC(2026, 7, 31, 12, 50, 1));
  assert.equal(strikes[1]!.lat, 51.102);
});

test("parsePerunCsv accepts comma headers lat,lon,time", () => {
  const csv = `time,lat,lon
2026-08-31T12:49:10Z,52.23,21.01
`;
  const strikes = parsePerunCsv(csv);
  assert.equal(strikes.length, 1);
  assert.equal(strikes[0]!.lat, 52.23);
  assert.equal(strikes[0]!.lon, 21.01);
  assert.equal(strikes[0]!.timeMs, Date.UTC(2026, 7, 31, 12, 49, 10));
});

test("parsePerunCsv uses the filename clock when a row has no timestamp", () => {
  const csv = `lat;lon
50.5;19.5
`;
  const fallback = csvTimeMs("2026.08.31.12.51.ld.csv");
  assert.equal(fallback, NOW);
  const strikes = parsePerunCsv(csv, { fallbackTimeMs: fallback ?? 0 });
  assert.equal(strikes[0]!.timeMs, NOW);
});

test("parsePerunCsv refuses an HTML bounce — never invents a strike", () => {
  const html = `<!doctype html>\n<html><body>datastore</body></html>`;
  assert.equal(isHtmlBounce(html), true);
  assert.deepEqual(parsePerunCsv(html), []);
});

test("listPerunCsvNames keeps PERUN_Polska .ld.csv files from a listing", () => {
  const html = `
    <a href="datastore/getfiledownOper/Perun/PERUN_Polska/2026.08.31.12.50.ld.csv">2026.08.31.12.50.ld.csv</a>
    <a href="datastore/getfiledownOper/Perun/PERUN_Polska/2026.08.31.12.50.ld">2026.08.31.12.50.ld</a>
    <a href="datastore/getfiledownOper/Perun/PERUN_Polska/2026.08.31.12.51.ld.csv">2026.08.31.12.51.ld.csv</a>
  `;
  assert.deepEqual(listPerunCsvNames(html), ["2026.08.31.12.50.ld.csv", "2026.08.31.12.51.ld.csv"]);
});

test("strikeNearCell is true only inside the cell radius", () => {
  const cell = { lat: 50.06, lon: 19.94 };
  assert.equal(strikeNearCell([{ lat: 50.07, lon: 19.95, timeMs: NOW }], cell), true);
  assert.equal(strikeNearCell([{ lat: 52.23, lon: 21.01, timeMs: NOW }], cell), false);
  assert.ok(NEAR_CELL_KM >= 15 && NEAR_CELL_KM <= 25);
});

test("strikeOpacity fades from fresh to the 15-min window", () => {
  assert.ok(strikeOpacity(0) > 0.8);
  assert.ok(strikeOpacity(STRIKE_WINDOW_MS) < 0.25);
  assert.equal(strikeOpacity(STRIKE_WINDOW_MS + 1_000), 0);
});

test("lightningCaption is the empty-state copy when no strikes shipped", () => {
  assert.equal(lightningCaption(0, true), PERUN_UNAVAILABLE);
  assert.equal(lightningCaption(0, false), PERUN_NO_STRIKES);
  assert.match(lightningCaption(4, false) ?? "", /4/);
  assert.equal(PERUN_NO_STRIKES, "Brak wyładowań w tej sesji");
  assert.equal(PERUN_UNAVAILABLE, "Wyładowania chwilowo niedostępne");
});

test("fetchPerunPolska: HTML bounce on the POLCOMP-style URL yields no strikes", async () => {
  const listing = `<a href="x">2026.08.31.12.51.ld.csv</a>`;
  const bounce = `<!doctype html><html><body>datastore</body></html>`;
  const seen: string[] = [];
  const posts: Array<string | undefined> = [];
  const scan = await fetchPerunPolska(NOW, async (url, init) => {
    seen.push(url);
    posts.push(typeof init?.body === "string" ? init.body : undefined);
    if (url.includes("getFilesList")) {
      return { url, status: 200, contentType: "text/html", body: listing };
    }
    return { url, status: 307, contentType: "text/html", body: bounce };
  });
  assert.equal(scan.unavailable, true);
  assert.deepEqual(scan.strikes, []);
  assert.ok(seen.some((u) => u.includes("getfiledown/Oper/Perun/PERUN_Polska/")));
  const listBody = posts.find((b) => b?.includes("path="));
  assert.match(listBody ?? "", /productType=oper/);
  assert.match(listBody ?? "", /path=%2FOper%2FPerun%2FPERUN_Polska/);
});

test("fetchPerunPolska: followed 307 (200 HTML datastore page) is gated, not a quiet sky", async () => {
  const listing = `<a href="x">2026.08.31.12.51.ld.csv</a>`;
  const bounce = `<!doctype html>\n<html lang="en"><body>Dane publiczne datastore</body></html>`;
  const scan = await fetchPerunPolska(NOW, async (url) => {
    if (url.includes("getFilesList")) {
      return { url, status: 200, contentType: "text/html", body: listing };
    }
    return { url, status: 200, contentType: "text/html; charset=UTF-8", body: bounce };
  });
  assert.equal(scan.unavailable, true);
  assert.deepEqual(scan.strikes, []);
});

test("fetchPerunPolska: a real CSV is parsed and kept", async () => {
  const listing = `<a href="x">2026.08.31.12.51.ld.csv</a>`;
  const scan = await fetchPerunPolska(NOW, async (url) => {
    if (url.includes("getFilesList")) {
      return { url, status: 200, contentType: "text/html", body: listing };
    }
    return { url, status: 200, contentType: "text/csv", body: SAMPLE_CSV };
  });
  assert.equal(scan.unavailable, false);
  assert.equal(scan.strikes.length, 2);
});
