# Hindcast error ledger (Slice 0)

One row per stormy-day run. Rafał types the **regime** by hand. Everything else is
copied from `npm run hindcast -- --json` so rows stay comparable.

This is the ruler later slices quote. It is not a dashboard.

## How to add a row

1. On (or just after) a stormy day, from the repo root:

   ```bash
   npm run hindcast -- --json
   ```

   Progress goes to stderr. stdout is one JSON object. Frames stay in the OS temp
   dir (`--cached` re-scores them; **never commit frames**).

2. Type the regime: `front` · `konwekcja` · `mieszane`.

3. Append **one row** to the [Log](#log) table. Use the column spec below. If a
   field is missing, write `—` — do not invent a number.

4. Paste the JSON under [JSON archive](#json-archive) (collapsed in review; the
   table is the thing people read).

`--json` scores **both** configs on the same frames:

| config | `leadMin` | `minLevel` | `minChancePct` |
|---|---|---|---|
| **shipped** | 30 | 2 | 50 |
| **research** | 60 | 1 and 2 (two blocks) | 0 |

Timeline POD/FAR/CSI vs persistence does not depend on alert settings (same
nowcast). Alert skill and ETA bias **do** — shipped uses a 30 min observation
window and klasa ≥ 2; research uses 60 min and both thresholds.

## Column spec

| Column | Source | Notes |
|---|---|---|
| `date` | `date` | UTC date of the latest scored frame |
| `regime` | hand | `front` / `konwekcja` / `mieszane` only |
| `window` | `radar.from`–`radar.to` | RainViewer past window, UTC |
| `age_s` | `radar.latestAgeSec` | newest frame age at run time (F2; scoring is still frame-time vs frame-time) |
| `cellKm` | `cellKm` | what production `aggregate()` would report from this 3 km cell count (F8). Scoring itself stays on the uncapped ~3 km hindcast grid |
| `samples` | `sampleCount.min`–`max` | per-frame echo cells |
| `advected` / `persist` / `crudeETA` | `motion.*Pct` | % of echo-≤100 km cases (F7). Must sum to ~100 |
| `n+L` / `p+L` | `nowcast[thr][L]` / `persist[thr][L]` | POD/FAR/CSI at lead *L* minutes. Default table cells are **klasa ≥ 2** (the shipped intensity). Research klasa ≥ 1 lives in the JSON |
| `alert_shipped` | `alerts.shipped.skill` | incoming, dry-now → klasa ≥ 2 within 30 min |
| `alert_research≥2` | `alerts.research.byThreshold["2"].skill` | same, research config (60 min, minChance 0) |
| `ETA_shipped` | `alerts.shipped.etaBiasMin` | p10 / p50 / p90 of (alert ETA − first observed), minutes; `—` if no hits |
| `ETA_research≥2` | `alerts.research.byThreshold["2"].etaBiasMin` | same, research |
| `szansa` | `szansa[]` | compact `bucket:n@obs%` for bins with n>0. Full table in JSON (F6) |
| `notes` | hand | weather one-liner; leave blank if nothing to say |

POD/FAR/CSI cells are written `P/F/C` in percent, e.g. `64/32/49`.

## Log

| date | regime | window UTC | age_s | cellKm | samples | advected | persist | crudeETA | n+30 ≥2 | p+30 ≥2 | n+60 ≥2 | p+60 ≥2 | alert_shipped | alert_research≥2 | ETA_shipped | ETA_research≥2 | szansa | notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 2026-08-31 | front | 05:50–07:50 | — | — | — | ~87% | — | — | — | — | — | — | — | 64/32/49 | — | p50 +10 (−20…+30) | — | Seed from [HINDCAST.md](HINDCAST.md) (research only; shipped / calibration / cellKm / frame age were not recorded). Front z SW, Dolny Śląsk. |

## JSON archive

The 2026-08-31 seed predates `--json`. Paste each new run's stdout here, newest last.
