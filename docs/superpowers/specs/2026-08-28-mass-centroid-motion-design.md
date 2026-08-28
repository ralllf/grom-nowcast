# Design: motion arrow = mass centroid + fieldShift (hybryda B)

Date: 2026-08-28  
Status: approved (user: „tak. naprawiaj”)

## Problem

Arrow shows wrong direction and wrong placement. Root cause: `pinWeightedCentroid` (weight `1/d` toward pin) pulls the glyph off the storm; motion is not firmly tied to the precip core.

## Intent

- **Arrow** = motion of the rain mass itself (bearing + speed of the cell/front). Anchored on the **mass center**, not the pin, not pointing at the pin.
- **Pin** = only for ETA / hit-miss / chance / copy.

## Approach (ETITAN-style hybrid)

1. Keep connected-component masses (`segmentMasses`, `LINK_KM`).
2. **Anchor:** reflectivity-weighted centroid of the mass (`level` weights). Prefer core samples `level ≥ 2` when ≥ 3 exist; else all `level ≥ 1`.
3. **Motion:** `systemMotion` / `fieldShift` centered on that centroid, using only that mass’s samples across matched frames. Trail fallback unchanged.
4. Remove `pinWeightedCentroid` from arrow placement.
5. Still max 2 arrows = up to 2 nearest masses; primary (nearest to pin) owns threat copy.

## Tests

- Contiguous west→east front: one arrow; `track.now` near mass centroid (west of pin when rain is west); `comingFrom === "zachodu"`.
- Arrow must not collapse onto the pin when rain is tens of km away.
- Existing suite stays green.

## Implementation note (2026-08-28)

Replaced product-of-intensities `fieldShift` with operational TREC-style pipeline:
km grid → large-scale box smooth → Pearson NCC → pair-agreement QC.
Pin is never an input to bearing. See `docs/ARCHITECTURE.md` § Komórki i wektory.

