import assert from "node:assert/strict";
import test from "node:test";
import { aeqdForward } from "./aeqd.ts";
import { aggregate, PL_RADAR_BBOX } from "./radar-grid.ts";
import {
  hitsFromSriGrid,
  parseSriListing,
  POLCOMP_SRI_GRID,
  sriFilenameTime,
  sriPixelToLonLat,
} from "./sri.ts";
import { levelFromRate } from "./palette.ts";

const LISTING = `
<li><a href="datastore/getfiledown/Oper/Polrad/Produkty/POLCOMP/COMPO_SRI.comp.sri/2026083112450000dBR.sri.h5">2026083112450000dBR.sri.h5</a></li>
<li><a href="datastore/getfiledown/Oper/Polrad/Produkty/POLCOMP/COMPO_SRI.comp.sri/2026083112450000dBR.sri_echoOnly.png">2026083112450000dBR.sri_echoOnly.png</a></li>
<li><a href="datastore/getfiledown/Oper/Polrad/Produkty/POLCOMP/COMPO_SRI.comp.sri/2026083112500000dBR.sri.h5">2026083112500000dBR.sri.h5</a></li>
<li><a href="datastore/getfiledown/Oper/Polrad/Produkty/POLCOMP/COMPO_SRI.comp.sri/2026083112550000dBR.sri.h5">2026083112550000dBR.sri.h5</a></li>
`;

test("parseSriListing keeps only .sri.h5 names, oldest first, 5-min cadence", () => {
  const files = parseSriListing(LISTING);
  assert.deepEqual(
    files.map((f) => f.name),
    [
      "2026083112450000dBR.sri.h5",
      "2026083112500000dBR.sri.h5",
      "2026083112550000dBR.sri.h5",
    ],
  );
  assert.equal(files[1]!.time - files[0]!.time, 5 * 60);
  assert.equal(files[2]!.time - files[1]!.time, 5 * 60);
  assert.equal(files[0]!.time, Date.UTC(2026, 7, 31, 12, 45, 0) / 1000);
});

test("sriFilenameTime reads the ODIM UTC stamp and ignores non-H5 names", () => {
  assert.equal(sriFilenameTime("2026083112550000dBR.sri.h5"), Date.UTC(2026, 7, 31, 12, 55, 0) / 1000);
  assert.equal(sriFilenameTime("2026083112550000dBR.sri_echoOnly.png"), null);
  assert.equal(sriFilenameTime("not-a-frame"), null);
});

test("DATA.md 900×900 is wrong: live POLCOMP SRI is 800×800 at ~1.16 km", () => {
  assert.equal(POLCOMP_SRI_GRID.nx, 800);
  assert.equal(POLCOMP_SRI_GRID.ny, 800);
  assert.ok(Math.abs(POLCOMP_SRI_GRID.xscale - 1163.64) < 0.1);
  assert.ok(Math.abs(POLCOMP_SRI_GRID.yscale - 1153.65) < 0.1);
});

test("Kraków and Warszawa land inside the 800×800 aeqd grid", () => {
  const krakow = aeqdForward(50.0614, 19.9366);
  const col = krakow.x / POLCOMP_SRI_GRID.xscale + POLCOMP_SRI_GRID.nx / 2;
  const row = POLCOMP_SRI_GRID.ny / 2 - krakow.y / POLCOMP_SRI_GRID.yscale;
  assert.ok(col > 0 && col < 800, `Kraków col ${col}`);
  assert.ok(row > 0 && row < 800, `Kraków row ${row}`);

  const back = sriPixelToLonLat(col, row, POLCOMP_SRI_GRID);
  assert.ok(Math.abs(back.lat - 50.0614) < 0.01);
  assert.ok(Math.abs(back.lon - 19.9366) < 0.01);
});

test("hitsFromSriGrid uses IMGW RATE mm/h, skips nodata/undetect, stays in the PL bbox", () => {
  const nx = 4;
  const ny = 4;
  const grid = {
    ...POLCOMP_SRI_GRID,
    nx,
    ny,
    nodata: -2,
    undetect: -1,
    gain: 1,
    offset: 0,
  };
  // Tiny grid still centred on the POLCOMP origin — pixel (2, 2) is near Płock.
  const data = new Float32Array(nx * ny).fill(-2);
  data[2 * nx + 2] = 12.5; // ≥ 10 mm/h → klasa 4
  data[2 * nx + 1] = -1;
  data[0] = 0;

  const hits = hitsFromSriGrid(data, grid);
  assert.equal(hits.length, 1);
  assert.equal(hits[0]!.rate, 12.5);
  assert.ok(hits[0]!.lat >= PL_RADAR_BBOX.minLat && hits[0]!.lat <= PL_RADAR_BBOX.maxLat);
  assert.ok(hits[0]!.lon >= PL_RADAR_BBOX.minLon && hits[0]!.lon <= PL_RADAR_BBOX.maxLon);

  const { samples, cellKm } = aggregate(hits);
  assert.equal(samples.length, 1);
  assert.equal(samples[0]!.level, levelFromRate(12.5));
  assert.equal(samples[0]!.rate, 12.5);
  assert.equal(cellKm, 3);
});
