import assert from "node:assert/strict";
import { unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import h5wasm from "h5wasm/node";
import { decodeSriH5 } from "./sri-h5.ts";
import { hitsFromSriGrid } from "./sri.ts";

test("decodeSriH5 reads ODIM RATE, where scales, and the scan clock", async () => {
  await h5wasm.ready;
  const path = join(tmpdir(), `grom-sri-h5-test-${process.pid}.h5`);
  const f = new h5wasm.File(path, "w");
  const where = f.create_group("where");
  where.create_attribute(
    "projdef",
    "+proj=aeqd +lon_0=19.0926 +lat_0=52.3469 +ellps=sphere",
  );
  where.create_attribute("xscale", 1163.641987013176);
  where.create_attribute("yscale", 1153.6468207035664);
  where.create_attribute("xsize", 4);
  where.create_attribute("ysize", 4);
  const what = f.create_group("what");
  what.create_attribute("date", "20260831");
  what.create_attribute("time", "125500");
  const d1 = f.create_group("dataset1");
  const d1what = d1.create_group("what");
  d1what.create_attribute("nodata", -2);
  d1what.create_attribute("undetect", -1);
  d1what.create_attribute("gain", 1);
  d1what.create_attribute("offset", 0);
  d1what.create_attribute("quantity", "RATE");
  const data = new Float32Array(16).fill(-2);
  data[2 * 4 + 2] = 7.5;
  d1.create_group("data1").create_dataset({ name: "data", data, shape: [4, 4] });
  f.flush();
  f.close();

  try {
    const { readFileSync } = await import("node:fs");
    const decoded = await decodeSriH5(new Uint8Array(readFileSync(path)));
    assert.equal(decoded.time, Date.UTC(2026, 7, 31, 12, 55, 0) / 1000);
    assert.equal(decoded.grid.nx, 4);
    assert.equal(decoded.grid.ny, 4);
    assert.equal(decoded.grid.nodata, -2);
    assert.equal(decoded.data.length, 16);
    assert.equal(decoded.data[2 * 4 + 2], 7.5);
    const hits = hitsFromSriGrid(decoded.data, decoded.grid);
    assert.equal(hits.length, 1);
    assert.equal(hits[0]!.rate, 7.5);
  } finally {
    unlinkSync(path);
  }
});
