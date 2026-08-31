import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";
import { DEFAULT_PLACE } from "./cities.ts";
import {
  applyTerytFallback,
  loadPowiatBoundaries,
  pointInPolygon,
  TERYT_FALLBACK_KM,
} from "./teryt.ts";

test("keeps an existing TERYT", async () => {
  const p = { lat: 52.23, lon: 21.01, label: "X", terc: "9999" };
  assert.equal((await applyTerytFallback(p)).terc, "9999");
});

test("point-in-polygon hits the containing ring and misses the outside", () => {
  const square = [
    [
      [0, 0],
      [2, 0],
      [2, 2],
      [0, 2],
      [0, 0],
    ],
  ];
  assert.equal(pointInPolygon(1, 1, square), true);
  assert.equal(pointInPolygon(3, 1, square), false);
});

test("point-in-polygon treats inner rings as holes", () => {
  const donut = [
    [
      [0, 0],
      [4, 0],
      [4, 4],
      [0, 4],
      [0, 0],
    ],
    [
      [1, 1],
      [3, 1],
      [3, 3],
      [1, 3],
      [1, 1],
    ],
  ];
  assert.equal(pointInPolygon(2, 2, donut), false);
  assert.equal(pointInPolygon(0.5, 0.5, donut), true);
});

/**
 * Official TERYT (4-digit powiat / miasto na prawach powiatu).
 * Town-center pins — city edges, rural gminy, Kraków-area tri-powiat cluster.
 * Sources: GUS TERYT + PRG/GUGiK boundaries.
 */
const ADVERSARIAL_PINS: { name: string; lat: number; lon: number; terc: string }[] = [
  { name: "Kraków Rynek (miasto)", lat: 50.0614, lon: 19.9373, terc: "1261" },
  { name: "Wieliczka Rynek (powiat wielicki)", lat: 49.9875, lon: 20.0647, terc: "1219" },
  { name: "Zielonki (powiat krakowski, N edge of Kraków)", lat: 50.1208, lon: 19.9169, terc: "1206" },
  { name: "Skawina Rynek (powiat krakowski, SW edge of Kraków)", lat: 49.9753, lon: 19.8273, terc: "1206" },
  { name: "Warszawa PKiN (miasto)", lat: 52.2316, lon: 21.0064, terc: "1465" },
  { name: "Piaseczno Rynek (powiat piaseczyński, S of Warsaw)", lat: 52.0754, lon: 21.0254, terc: "1418" },
  { name: "Cisna (powiat leski, rural Bieszczady)", lat: 49.2114, lon: 22.3289, terc: "1821" },
  { name: "Ustrzyki Górne (powiat bieszczadzki, rural)", lat: 49.1047, lon: 22.6503, terc: "1801" },
  { name: "Pruszcz Gdański (powiat gdański, S of Gdańsk)", lat: 54.2633, lon: 18.64, terc: "2204" },
  { name: "Siechnice (powiat wrocławski, SE of Wrocław)", lat: 51.0342, lon: 17.1475, terc: "0223" },
];

test("10 adversarial pins match official TERYT (PIP, not nearest city)", async () => {
  for (const pin of ADVERSARIAL_PINS) {
    const out = await applyTerytFallback({ lat: pin.lat, lon: pin.lon, label: pin.name });
    assert.equal(out.terc, pin.terc, `${pin.name} → ${pin.terc}, got ${out.terc}`);
  }
});

test("Warsaw-area pin without TERYT gets 1465 from the city polygon", async () => {
  const p = { lat: 52.24, lon: 21.02, label: "Punkt na mapie" };
  const out = await applyTerytFallback(p);
  assert.equal(out.terc, DEFAULT_PLACE.terc);
  assert.equal(out.label, "Punkt na mapie");
});

test("Kraków city pin without TERYT gets 1261 from the city polygon", async () => {
  const out = await applyTerytFallback({ lat: 50.08, lon: 19.94, label: "Pin" });
  assert.equal(out.terc, "1261");
});

test("rural Bieszczady pin gets a real powiat TERYT", async () => {
  // 49.2, 22.8 is across the border in Ukraine — use Cisna, far from the 21-city list.
  const out = await applyTerytFallback({ lat: 49.2114, lon: 22.3289, label: "Bieszczady" });
  assert.equal(out.terc, "1821");
});

test("open water / outside Poland stays without TERYT", async () => {
  const out = await applyTerytFallback({ lat: 55.4, lon: 18.5, label: "Bałtyk" });
  assert.equal(out.terc, undefined);
});

test("nearest-city TERYT is last resort when the pin is outside every powiat", async () => {
  // ~4 km west of Zgorzelec, in Germany — no PRG hit, still within 30 km of the city list.
  const out = await applyTerytFallback({ lat: 51.1492, lon: 14.95, label: "DE" });
  assert.equal(out.terc, "0225");
});

test("nearest-city fallback stays a 30 km last resort", () => {
  assert.equal(TERYT_FALLBACK_KM, 30);
});

test("powiat polygon asset is lazy-sized (tens–few hundred kB)", async () => {
  const file = new URL("./powiaty.json", import.meta.url);
  const s = await stat(file);
  assert.ok(s.size > 40_000, `too small to be national powiaty: ${s.size}`);
  assert.ok(s.size < 500_000, `must stay a few hundred kB, got ${s.size}`);
  const powiaty = await loadPowiatBoundaries();
  assert.equal(powiaty.length, 380);
});

test("teryt.ts lazy-loads powiaty.json (no static import)", async () => {
  const src = await readFile(new URL("./teryt.ts", import.meta.url), "utf8");
  assert.match(src, /import\(\s*["']\.\/powiaty\.json["']/);
  assert.equal(/\bimport\s+[^()]+from\s+["']\.\/powiaty\.json["']/.test(src), false);
});
