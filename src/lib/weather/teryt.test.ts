import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_PLACE } from "./cities.ts";
import { applyTerytFallback, TERYT_FALLBACK_KM } from "./teryt.ts";

test("keeps an existing TERYT", () => {
  const p = { lat: 52.23, lon: 21.01, label: "X", terc: "9999" };
  assert.equal(applyTerytFallback(p).terc, "9999");
});

test("Warsaw-area pin without TERYT gets 1465", () => {
  const p = { lat: 52.24, lon: 21.02, label: "Punkt na mapie" };
  const out = applyTerytFallback(p);
  assert.equal(out.terc, DEFAULT_PLACE.terc);
  assert.equal(out.label, "Punkt na mapie");
});

test("Kraków suburb within 30 km gets Kraków TERYT", () => {
  const out = applyTerytFallback({ lat: 50.08, lon: 19.94, label: "Pin" });
  assert.equal(out.terc, "1261");
});

test("open country far from listed cities stays without TERYT", () => {
  const out = applyTerytFallback({ lat: 49.2, lon: 22.8, label: "Bieszczady" });
  assert.equal(out.terc, undefined);
});

test("fallback radius is 30 km", () => {
  assert.equal(TERYT_FALLBACK_KM, 30);
});
