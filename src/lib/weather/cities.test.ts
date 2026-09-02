import assert from "node:assert/strict";
import test from "node:test";
import { CITIES, DEFAULT_PLACE, nadPhrase } from "./cities.ts";

test("nadPhrase uses instrumental for shipped cities, not nominative", () => {
  assert.equal(nadPhrase("Warszawa"), "nad Warszawą");
  assert.equal(nadPhrase("Kraków"), "nad Krakowem");
  assert.equal(nadPhrase("Łódź"), "nad Łodzią");
  assert.equal(nadPhrase("Wrocław"), "nad Wrocławiem");
  assert.doesNotMatch(nadPhrase("Warszawa"), /nad Warszawa$/);
  assert.doesNotMatch(nadPhrase("Kraków"), /nad Kraków$/);
});

test("nadPhrase falls back to pinezka for a map point or unknown city", () => {
  assert.equal(nadPhrase("Punkt na mapie"), "nad Twoją pinezką");
  assert.equal(nadPhrase("Twoja lokalizacja"), "nad Twoją pinezką");
  assert.equal(nadPhrase("Testowo"), "nad Twoją pinezką");
  assert.equal(nadPhrase(""), "nad Twoją pinezką");
});

test("city chips stay nominative — instrumental is a separate field", () => {
  assert.equal(DEFAULT_PLACE.label, "Warszawa");
  assert.equal(CITIES.find((c) => c.label === "Kraków")?.label, "Kraków");
  const chips = CITIES.slice(0, 12).map((c) => c.label);
  assert.deepEqual(chips, [
    "Warszawa",
    "Kraków",
    "Wrocław",
    "Zgorzelec",
    "Poznań",
    "Gdańsk",
    "Łódź",
    "Katowice",
    "Lublin",
    "Szczecin",
    "Białystok",
    "Rzeszów",
  ]);
});
