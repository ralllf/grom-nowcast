import assert from "node:assert/strict";
import test from "node:test";
import { aeqdForward, aeqdInverse, SRI_LAT0, SRI_LON0, SRI_R } from "./aeqd.ts";

test("origin of POLCOMP aeqd is (0, 0) metres", () => {
  const xy = aeqdForward(SRI_LAT0, SRI_LON0);
  assert.ok(Math.abs(xy.x) < 1e-6);
  assert.ok(Math.abs(xy.y) < 1e-6);
  const ll = aeqdInverse(0, 0);
  assert.ok(Math.abs(ll.lat - SRI_LAT0) < 1e-9);
  assert.ok(Math.abs(ll.lon - SRI_LON0) < 1e-9);
});

test("inverse ∘ forward round-trips Polish cities within 2 m", () => {
  const cities = [
    { name: "Kraków", lat: 50.0614, lon: 19.9366 },
    { name: "Warszawa", lat: 52.2297, lon: 21.0122 },
    { name: "Gdańsk", lat: 54.352, lon: 18.6466 },
    { name: "Wrocław", lat: 51.1079, lon: 17.0385 },
  ];
  for (const c of cities) {
    const xy = aeqdForward(c.lat, c.lon);
    const back = aeqdInverse(xy.x, xy.y);
    const dx = aeqdForward(back.lat, back.lon);
    const err = Math.hypot(dx.x - xy.x, dx.y - xy.y);
    assert.ok(err < 2, `${c.name} error ${err} m`);
    assert.ok(Math.abs(back.lat - c.lat) < 1e-6);
    assert.ok(Math.abs(back.lon - c.lon) < 1e-6);
  }
});

test("PROJ +ellps=sphere radius is 6 370 997 m", () => {
  assert.equal(SRI_R, 6_370_997);
});
