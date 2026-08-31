import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { shouldFallbackBasemap } from "./map-boot.ts";

describe("shouldFallbackBasemap", () => {
  it("falls back before style.load on fetch / 403 / WebGL errors", () => {
    assert.equal(shouldFallbackBasemap("Failed to fetch", false), true);
    assert.equal(shouldFallbackBasemap("403 forbidden", false), true);
    assert.equal(shouldFallbackBasemap("GPUInitializationError: webgl2", false), true);
  });

  it("does not rip out a live style on a later tile miss", () => {
    assert.equal(shouldFallbackBasemap("Failed to fetch", true), false);
    assert.equal(shouldFallbackBasemap("404", false), false);
  });
});
