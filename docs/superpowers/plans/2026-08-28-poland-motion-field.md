# Poland Motion Field Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pin-free rain-motion arrows for a fixed Poland radar domain, refreshed only with radar frames; pin only drives warnings/ETA text.

**Architecture:** Server samples RainViewer over a Poland bbox (cached per frame time). `computeThreat` builds tracks from that field without using the pin for selection/style; pin is used only for ETA/chance/copy/warnings. Client snapshot query is not keyed by pin. Arrow length scales with speed in geographic km.

**Tech Stack:** TypeScript, existing `threat.ts` / `server.ts` / `grom-app.tsx` / `radar-map.tsx`, node:test.

**Spec:** `docs/superpowers/specs/2026-08-28-poland-motion-field-design.md`

## Global Constraints

- Polish UI copy unchanged in tone.
- No pin in track geometry/selection/threatening.
- TDD for threat behavior; typecheck + threat tests green.

---

### Task 1: Pin-free track selection + speed-proportional length (threat)

**Files:** `src/lib/weather/threat.ts`, `src/lib/weather/threat.test.ts`, `docs/ARCHITECTURE.md`

- [x] **Step 1: RED** — Test: two pins + Poland-scale origin → identical track anchors/bearings/`threatening`; test: faster mass → longer `now→soon` geo distance than slower mass (same bearing).
- [x] **Step 2:** Run tests — confirm fail.
- [x] **Step 3: GREEN** — Tracks ranked by strength only; `MAX_TRACKS ≈ 6`; `makeTrack` look-ahead = `speed * (30/60)` (no large min km floor); keep pin only for ETA narrative.
- [x] **Step 4:** All threat tests pass; update ARCHITECTURE one paragraph.

### Task 2: Poland bbox sampling + national cache (server)

**Files:** `src/lib/weather/server.ts`, optionally small pure helper + test for bbox/tiles if extractable

- [x] **Step 1:** Replace pin-radius crop with Poland bbox (+ border); lift tile/sample caps enough for PL; `sampleRadar()` ignores pin lat/lon for crop (pin only for place/warnings in `getSnapshot`).
- [x] **Step 2:** Cache radar scan by RainViewer `latestTime` (~60–90s reuse).
- [x] **Step 3:** `npm run typecheck` passes.

### Task 3: Client — snapshot independent of pin; draw length from geo

**Files:** `src/components/grom-app.tsx`, `src/components/radar-map.tsx`

- [x] **Step 1:** Snapshot `queryKey` without pin/origin; pass place only for warnings/geocode; remove radar recentering-on-pin for sampling.
- [x] **Step 2:** `drawTracks`: drop `extendMinPx` floor (or tiny floor only); length follows projected `soon` from speed.
- [x] **Step 3:** typecheck + threat tests green.

### Task 4: Verify

- [x] **Step 1:** `npm run typecheck` && threat test suite.
- [ ] **Step 2:** Summarize behavior for user (no commit unless asked).
