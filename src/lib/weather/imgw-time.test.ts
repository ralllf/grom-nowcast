import assert from "node:assert/strict";
import test from "node:test";
import { formatImgwWhen, isActiveWarning, parseImgwWarsaw } from "./imgw-time.ts";

test("CEST (July) is UTC+2", () => {
  const t = parseImgwWarsaw("2026-07-15 23:30:00");
  assert.equal(new Date(t).toISOString(), "2026-07-15T21:30:00.000Z");
});

test("CET (January) is UTC+1", () => {
  const t = parseImgwWarsaw("2026-01-15 23:30:00");
  assert.equal(new Date(t).toISOString(), "2026-01-15T22:30:00.000Z");
});

test("space or T separator both parse", () => {
  assert.equal(parseImgwWarsaw("2026-07-15 12:00:00"), parseImgwWarsaw("2026-07-15T12:00:00"));
});

test("Date.parse-as-UTC would be two hours late in July", () => {
  const raw = "2026-07-15 14:00:00";
  const naive = Date.parse(raw.replace(" ", "T"));
  const warsaw = parseImgwWarsaw(raw);
  assert.equal(naive - warsaw, 2 * 3600_000);
});

test("garbage input is NaN", () => {
  assert.ok(Number.isNaN(parseImgwWarsaw("nie-data")));
});

test("isActive includes the 30-minute pre-start window", () => {
  const from = "2026-07-15 15:00:00";
  const to = "2026-07-15 18:00:00";
  const start = parseImgwWarsaw(from);
  assert.equal(isActiveWarning(from, to, start - 20 * 60_000), true);
  assert.equal(isActiveWarning(from, to, start - 40 * 60_000), false);
  assert.equal(isActiveWarning(from, to, start + 60 * 60_000), true);
  assert.equal(isActiveWarning(from, to, parseImgwWarsaw(to) + 1), false);
});

test("unparseable bounds stay active", () => {
  assert.equal(isActiveWarning("x", "y"), true);
});

test("formatImgwWhen stays on the Warsaw clock", () => {
  const text = formatImgwWhen("2026-07-15 23:30:00");
  assert.match(text, /23:30/);
});

test("midnight Warsaw does not roll to the previous UTC date in the label", () => {
  const text = formatImgwWhen("2026-07-16 00:15:00");
  assert.match(text, /16/);
  assert.match(text, /00:15/);
});

test("seconds are optional", () => {
  const t = parseImgwWarsaw("2026-07-15 12:00");
  assert.equal(new Date(t).toISOString(), "2026-07-15T10:00:00.000Z");
});

test("formatImgwRange same Warsaw day is dziś HH:mm–HH:mm", async () => {
  const { formatImgwRange } = await import("./imgw-time.ts");
  const now = parseImgwWarsaw("2026-08-31 12:00:00");
  assert.equal(
    formatImgwRange("2026-08-31 14:00:00", "2026-08-31 22:00:00", now),
    "dziś 14:00–22:00",
  );
});

test("formatImgwRange next Warsaw day is jutro", async () => {
  const { formatImgwRange } = await import("./imgw-time.ts");
  const now = parseImgwWarsaw("2026-08-31 12:00:00");
  assert.equal(
    formatImgwRange("2026-09-01 08:00:00", "2026-09-01 16:00:00", now),
    "jutro 08:00–16:00",
  );
});

test("formatImgwRange overnight spans dziś and jutro", async () => {
  const { formatImgwRange } = await import("./imgw-time.ts");
  const now = parseImgwWarsaw("2026-08-31 20:00:00");
  assert.equal(
    formatImgwRange("2026-08-31 22:00:00", "2026-09-01 06:00:00", now),
    "dziś 22:00 – jutro 06:00",
  );
});
