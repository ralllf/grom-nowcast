import assert from "node:assert/strict";
import test from "node:test";
import { aeqdForward } from "./aeqd.ts";
import { aggregate, PL_RADAR_BBOX } from "./radar-grid.ts";
import {
  hitsFromSriGrid,
  parseSriListing,
  POLCOMP_SRI_GRID,
  sriFilenameTime,
  sriGeorefFromCorners,
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

/** Live COMPO_SRI `/where` from calc review 06 §1 (`2026090118350000dBR.sri.h5`). */
const LIVE_WHERE = {
  ulLon: 11.6,
  ulLat: 56.3,
  lrLon: 25.3,
  lrLat: 48.0,
  nx: 800,
  ny: 800,
};

test("ODIM UL/LR corners imply 1154.40 × 1159.81 m pixels, not attr xscale/yscale", () => {
  const geo = sriGeorefFromCorners(
    LIVE_WHERE.ulLon,
    LIVE_WHERE.ulLat,
    LIVE_WHERE.lrLon,
    LIVE_WHERE.lrLat,
    LIVE_WHERE.nx,
    LIVE_WHERE.ny,
  );
  assert.ok(Math.abs(geo.xscale - 1154.4) < 0.05, `xscale ${geo.xscale}`);
  assert.ok(Math.abs(geo.yscale - 1159.81) < 0.05, `yscale ${geo.yscale}`);

  const warsaw = { lat: 52.2297, lon: 21.0122 };
  const xy = aeqdForward(warsaw.lat, warsaw.lon);
  const col = (xy.x - geo.x0) / geo.xscale - 0.5;
  const row = (geo.y0 - xy.y) / geo.yscale - 0.5;

  const cornerGrid = { ...POLCOMP_SRI_GRID, ...geo };
  const llNew = sriPixelToLonLat(col, row, cornerGrid);
  const xyNew = aeqdForward(llNew.lat, llNew.lon);
  const newErr = Math.hypot(xyNew.x - xy.x, xyNew.y - xy.y);
  assert.ok(newErr < 2, `corner georef ${newErr} m from projected Warszawa`);

  const llOld = sriPixelToLonLat(col, row, POLCOMP_SRI_GRID);
  const xyOld = aeqdForward(llOld.lat, llOld.lon);
  const oldErr = Math.hypot(xyOld.x - xy.x, xyOld.y - xy.y);
  assert.ok(oldErr > 800 && oldErr < 1300, `attr-scale Warszawa shift ${oldErr} m`);
  assert.ok(newErr < oldErr / 10, `new ${newErr} m should crush old ${oldErr} m`);
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
    x0: -(nx / 2) * POLCOMP_SRI_GRID.xscale,
    y0: (ny / 2) * POLCOMP_SRI_GRID.yscale,
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
