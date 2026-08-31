# Hindcast error ledger (Slice 0)

One row per stormy-day run. Rafał types the **regime** by hand. Everything else is
copied from `npm run hindcast -- --json` so rows stay comparable.

This is the ruler later slices quote. It is not a dashboard.

## How to add a row

1. On (or just after) a stormy day, from the repo root:

   ```bash
   npm run --silent hindcast -- --json
   ```

   Progress goes to stderr. stdout is one JSON object (`--silent` hides npm's
   two-line banner). Frames stay in the OS temp dir (`--cached` re-scores them;
   **never commit frames**).

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
| 2026-08-31 | front | 09:40–11:40 | 459 | 3 | 5069–5505 | 93% | 6% | 0.6% | 77/39/52 | 63/42/43 | 60/55/34 | 44/59/27 | 51/47/35 | 45/42/34 | −10/0/+15 | −10/+5/+20 | 0-19:219@10%; 50-59:28@18%; 60-69:75@56%; 70-79:27@89%; 80-89:109@90%; 90:33@100% | First `--json` seed. Same day as the morning front; leftover echo, ~5k cells (no coarsen). |

## JSON archive

Morning 2026-08-31 row predates `--json`. Midday row:

```json
{
  "date": "2026-08-31",
  "runAt": "2026-08-31T11:47:38.628Z",
  "radar": {
    "from": "2026-08-31T09:40:00.000Z",
    "to": "2026-08-31T11:40:00.000Z",
    "frames": 13,
    "latestAgeSec": 459
  },
  "cellKm": [3],
  "sampleCount": { "min": 5069, "max": 5505 },
  "motion": {
    "allCases": 672,
    "echoCases": 494,
    "advectedPct": 93.11740890688259,
    "persistPct": 6.275303643724697,
    "crudeEtaPct": 0.6072874493927125
  },
  "nowcast": {
    "1": {
      "10": { "pod": 0.854, "far": 0.061, "csi": 0.809, "n": 494, "obs": 144 },
      "20": { "pod": 0.804, "far": 0.096, "csi": 0.741, "n": 494, "obs": 153 },
      "30": { "pod": 0.761, "far": 0.175, "csi": 0.656, "n": 494, "obs": 155 },
      "40": { "pod": 0.736, "far": 0.225, "csi": 0.606, "n": 494, "obs": 159 },
      "50": { "pod": 0.724, "far": 0.289, "csi": 0.559, "n": 494, "obs": 156 },
      "60": { "pod": 0.736, "far": 0.343, "csi": 0.532, "n": 494, "obs": 148 }
    },
    "2": {
      "10": { "pod": 0.810, "far": 0.179, "csi": 0.688, "n": 494, "obs": 79 },
      "20": { "pod": 0.750, "far": 0.321, "csi": 0.553, "n": 494, "obs": 76 },
      "30": { "pod": 0.773, "far": 0.389, "csi": 0.518, "n": 494, "obs": 75 },
      "40": { "pod": 0.628, "far": 0.495, "csi": 0.389, "n": 494, "obs": 78 },
      "50": { "pod": 0.605, "far": 0.521, "csi": 0.365, "n": 494, "obs": 76 },
      "60": { "pod": 0.600, "far": 0.554, "csi": 0.344, "n": 494, "obs": 75 }
    }
  },
  "persist": {
    "1": {
      "10": { "pod": 0.854, "far": 0.134, "csi": 0.755, "n": 494, "obs": 144 },
      "20": { "pod": 0.745, "far": 0.197, "csi": 0.630, "n": 494, "obs": 153 },
      "30": { "pod": 0.684, "far": 0.254, "csi": 0.555, "n": 494, "obs": 155 },
      "40": { "pod": 0.635, "far": 0.289, "csi": 0.505, "n": 494, "obs": 159 },
      "50": { "pod": 0.603, "far": 0.338, "csi": 0.461, "n": 494, "obs": 156 },
      "60": { "pod": 0.554, "far": 0.423, "csi": 0.394, "n": 494, "obs": 148 }
    },
    "2": {
      "10": { "pod": 0.835, "far": 0.185, "csi": 0.702, "n": 494, "obs": 79 },
      "20": { "pod": 0.711, "far": 0.333, "csi": 0.524, "n": 494, "obs": 76 },
      "30": { "pod": 0.627, "far": 0.420, "csi": 0.431, "n": 494, "obs": 75 },
      "40": { "pod": 0.551, "far": 0.469, "csi": 0.371, "n": 494, "obs": 78 },
      "50": { "pod": 0.474, "far": 0.556, "csi": 0.298, "n": 494, "obs": 76 },
      "60": { "pod": 0.440, "far": 0.593, "csi": 0.268, "n": 494, "obs": 75 }
    }
  },
  "alerts": {
    "research": {
      "leadMin": 60,
      "minChancePct": 0,
      "byThreshold": {
        "1": { "skill": { "pod": 0.559, "far": 0.246, "csi": 0.473, "n": 352, "obs": 93 }, "etaBiasMin": { "n": 52, "p10": -10, "p50": 0, "p90": 20 } },
        "2": { "skill": { "pod": 0.446, "far": 0.421, "csi": 0.337, "n": 413, "obs": 74 }, "etaBiasMin": { "n": 33, "p10": -10, "p50": 5, "p90": 20 } }
      }
    },
    "shipped": {
      "leadMin": 30,
      "minLevel": 2,
      "minChancePct": 50,
      "skill": { "pod": 0.514, "far": 0.471, "csi": 0.353, "n": 413, "obs": 35 },
      "etaBiasMin": { "n": 18, "p10": -10, "p50": 0, "p90": 15 }
    }
  },
  "szansa": [
    { "bucket": "0-19", "n": 219, "meanChancePct": 10.3, "observedRate": 0.100 },
    { "bucket": "20-29", "n": 2, "meanChancePct": 22.5, "observedRate": 0 },
    { "bucket": "40-49", "n": 1, "meanChancePct": 40, "observedRate": 0 },
    { "bucket": "50-59", "n": 28, "meanChancePct": 55, "observedRate": 0.179 },
    { "bucket": "60-69", "n": 75, "meanChancePct": 60, "observedRate": 0.56 },
    { "bucket": "70-79", "n": 27, "meanChancePct": 70, "observedRate": 0.889 },
    { "bucket": "80-89", "n": 109, "meanChancePct": 80, "observedRate": 0.899 },
    { "bucket": "90-100", "n": 33, "meanChancePct": 90, "observedRate": 1 }
  ]
}
```

Rounded rates; hit/miss/fa/cn live in `--json` stdout if a later slice needs the raw counts.
