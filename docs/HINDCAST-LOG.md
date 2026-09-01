# Hindcast error ledger (Slice 0)

One row per stormy-day run. Rafał types the **regime** by hand. Everything else is
copied from `npm run --silent hindcast -- --json` so rows stay comparable.

This is the ruler later slices quote. It is not a dashboard.

## How to add a row

1. On (or just after) a stormy day, from the repo root:

   ```bash
   npm run --silent hindcast -- --json
   npm run --silent hindcast -- --sri --json   # IMGW COMPO_SRI, 5 min
   ```

   Scoring compares the frame **lead minutes** later, not `lead / 10` frames later (RainViewer 10 min is unchanged; SRI 5 min was not).

   Progress goes to stderr. stdout is one JSON object (`--silent` hides npm's
   two-line banner). Frames stay in the OS temp dir (`--cached` re-scores them;
   **never commit frames**). `--cached` keeps the download stamp when present so
   `age_s` is the age *at fetch*, not at re-score. An old cache without a stamp
   prints `latestAgeSec: null` — write `—` in the table.

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
| `cellKm` | `cellKm` | **proxy** from this run's already-filtered 3 km echo-cell count vs the 9 000-sample coarsen rule (F8). Not the server's pre-filter `aggregate()`. Scoring stays on the uncapped ~3 km hindcast grid |
| `samples` | `sampleCount.min`–`max` | per-frame echo cells |
| `advected` / `persist` / `crudeETA` | `motion.*Pct` | % of echo-≤100 km cases (F7). Must sum to ~100 |
| `n+L` / `p+L` | `nowcast[thr][L]` / `persist[thr][L]` | POD/FAR/CSI at lead *L* minutes. Default table cells are **klasa ≥ 2** (the shipped intensity). Research klasa ≥ 1 lives in the JSON |
| `alert_shipped` | `alerts.shipped.skill` | incoming, dry-now → klasa ≥ 2 within 30 min |
| `alert_research≥2` | `alerts.research.byThreshold["2"].skill` | same, research config (60 min, minChance 0) |
| `ETA_shipped` | `alerts.shipped.etaBiasMin` | p10 / p50 / p90 of (alert ETA − first observed), minutes; `—` if no hits |
| `ETA_research≥2` | `alerts.research.byThreshold["2"].etaBiasMin` | same, research |
| `szansa` | `szansa[]` | compact `bucket:n@obs%` for bins with n>0. Full table in JSON (F6). **Echo ≤ 100 km only** — dry / Czysto pins (typical chance 10) are not in the table. Observed = rain ≥ klasa 1 over the pin within 60 min |
| `notes` | hand | weather one-liner; leave blank if nothing to say |

POD/FAR/CSI cells are written `P/F/C` in percent, e.g. `64/32/49`.

## Slice 8 remap (2026-08-31)

No SRI-era row and no held-out day exist yet. Slice 8 remaps echo-driven Szansa
from the **one published midday row** above (`2026-08-31`, window 09:40–11:40,
RainViewer). Observed = rain ≥ klasa 1 over the pin within 60 min, echo ≤ 100 km.

Dry / IMGW-only pins are **not** in this table and keep their raw rungs.

| raw rung | n | mean raw | observed | shipped | ±10 pt gate |
|---|---|---|---|---|---|
| 0–19 | 219 | 10.3 | 10% | **10** | yes |
| 20–29 | 2 | 22.5 | 0% | **10** | n<20, conservative |
| 30–39 | 0 | — | — | **15** | empty |
| 40–49 | 1 | 40 | 0% | **15** | n<20 |
| 50–59 | 28 | 55 | 18% | **20** | yes |
| 60–69 | 75 | 60 | 56% | **55** | yes |
| 70–79 | 27 | 70 | 89% | **90** | yes |
| 80–89 | 109 | 80 | 90% | **90** | yes |
| 90–100 | 33 | 90 | 100% | **95** | yes |

The table lives in [`src/lib/weather/chance.ts`](../src/lib/weather/chance.ts) and
is asserted by `chance.test.ts`. Re-run `npm run --silent hindcast -- --sri --json`
on a stormy day and add a row here before tightening the bins.

Alert implication at shipped defaults (`leadMin` 30, `minLevel` 2, `minChancePct` 50):
the well-calibrated willHit+approaching rung (60 → 55) still clears the gate; the
overconfident close-echo rung (55 → 20, obs 18%) no longer fires. That should
not worsen POD and should cut FAR. Confirm on the next logged day.

## Slice 9 gate (2026-08-31) — copy only, math off

The plan lets timeline / ETA move for growing cells only on **≥ 3 convective
log days**, with POD at +20…+40 min up, FAR up by < 3 pts, and ETA median bias
toward 0.

Published rows today: **2**, both `front`. Convective days: **0**. Slice 0's
own success check (≥ 5 days including ≥ 2 convective) is also unmet.

`GROWTH_MATH_ENABLED` in [`src/lib/weather/trend.ts`](../src/lib/weather/trend.ts)
stays **false**. The sheet ships **Komórka rośnie / słabnie** from the 4-frame
trail; nowcast numbers do not change. Re-open the math only after three
`konwekcja` rows exist and the numbers above hold.

## Log

| date | regime | window UTC | age_s | cellKm | samples | advected | persist | crudeETA | n+30 ≥2 | p+30 ≥2 | n+60 ≥2 | p+60 ≥2 | alert_shipped | alert_research≥2 | ETA_shipped | ETA_research≥2 | szansa | notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 2026-08-31 | front | 05:50–07:50 | — | — | — | ~87% | — | — | — | — | — | — | — | 64/32/49 | — | p50 +10 (−20…+30) | — | Seed from [HINDCAST.md](HINDCAST.md) (research only; shipped / calibration / cellKm / frame age were not recorded). Front z SW, Dolny Śląsk. |
| 2026-08-31 | front | 09:40–11:40 | 459 | 3 | 5069–5505 | 93% | 6% | 0.6% | 77/39/52 | 63/42/43 | 60/55/34 | 44/59/27 | 51/47/35 | 45/42/34 | −10/0/+15 | −10/+5/+20 | 0-19:219@10%; 20-29:2@0%; 40-49:1@0%; 50-59:28@18%; 60-69:75@56%; 70-79:27@89%; 80-89:109@90%; 90-100:33@100% | First `--json` seed. Same day as the morning front; leftover echo, ~5k cells (no coarsen). Szansa = echo ≤ 100 km only. |
| 2026-09-01 | mieszane | 13:45–15:40 | 189 | 3 | 4065–5643 | 89% | 11% | 0% | 70/40/47 | 45/56/29 | 66/61/32 | 39/66/22 | 64/30/50 | 73/30/56 | −10/0/+10 | −15/0/+15 | 0-19:677@11%; 20-29:23@48%; 50-59:268@47%; 90-100:460@88% | First cadence-aware SRI `--json` (24 × 5 min COMPO_SRI). Leftover echo, cells 5.6k→4.1k. Not convective. |

## JSON archive

Morning 2026-08-31 row predates `--json`. Midday RainViewer row and the 2026-09-01 SRI row are live `--json` stdout (verbatim, npm banner stripped).

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
  "cellKm": [
    3
  ],
  "sampleCount": {
    "min": 5069,
    "max": 5505
  },
  "motion": {
    "allCases": 672,
    "echoCases": 494,
    "advectedPct": 93.11740890688259,
    "persistPct": 6.275303643724697,
    "crudeEtaPct": 0.6072874493927125
  },
  "nowcast": {
    "1": {
      "10": {
        "hit": 123,
        "miss": 21,
        "fa": 8,
        "cn": 342,
        "pod": 0.8541666666666666,
        "far": 0.061068702290076333,
        "csi": 0.8092105263157895,
        "n": 494,
        "obs": 144
      },
      "20": {
        "hit": 123,
        "miss": 30,
        "fa": 13,
        "cn": 328,
        "pod": 0.803921568627451,
        "far": 0.09558823529411764,
        "csi": 0.7409638554216867,
        "n": 494,
        "obs": 153
      },
      "30": {
        "hit": 118,
        "miss": 37,
        "fa": 25,
        "cn": 314,
        "pod": 0.7612903225806451,
        "far": 0.17482517482517482,
        "csi": 0.6555555555555556,
        "n": 494,
        "obs": 155
      },
      "40": {
        "hit": 117,
        "miss": 42,
        "fa": 34,
        "cn": 301,
        "pod": 0.7358490566037735,
        "far": 0.2251655629139073,
        "csi": 0.6062176165803109,
        "n": 494,
        "obs": 159
      },
      "50": {
        "hit": 113,
        "miss": 43,
        "fa": 46,
        "cn": 292,
        "pod": 0.7243589743589743,
        "far": 0.2893081761006289,
        "csi": 0.5594059405940595,
        "n": 494,
        "obs": 156
      },
      "60": {
        "hit": 109,
        "miss": 39,
        "fa": 57,
        "cn": 289,
        "pod": 0.7364864864864865,
        "far": 0.3433734939759036,
        "csi": 0.5317073170731708,
        "n": 494,
        "obs": 148
      }
    },
    "2": {
      "10": {
        "hit": 64,
        "miss": 15,
        "fa": 14,
        "cn": 401,
        "pod": 0.810126582278481,
        "far": 0.1794871794871795,
        "csi": 0.6881720430107527,
        "n": 494,
        "obs": 79
      },
      "20": {
        "hit": 57,
        "miss": 19,
        "fa": 27,
        "cn": 391,
        "pod": 0.75,
        "far": 0.32142857142857145,
        "csi": 0.5533980582524272,
        "n": 494,
        "obs": 76
      },
      "30": {
        "hit": 58,
        "miss": 17,
        "fa": 37,
        "cn": 382,
        "pod": 0.7733333333333333,
        "far": 0.3894736842105263,
        "csi": 0.5178571428571429,
        "n": 494,
        "obs": 75
      },
      "40": {
        "hit": 49,
        "miss": 29,
        "fa": 48,
        "cn": 368,
        "pod": 0.6282051282051282,
        "far": 0.4948453608247423,
        "csi": 0.3888888888888889,
        "n": 494,
        "obs": 78
      },
      "50": {
        "hit": 46,
        "miss": 30,
        "fa": 50,
        "cn": 368,
        "pod": 0.6052631578947368,
        "far": 0.5208333333333334,
        "csi": 0.36507936507936506,
        "n": 494,
        "obs": 76
      },
      "60": {
        "hit": 45,
        "miss": 30,
        "fa": 56,
        "cn": 363,
        "pod": 0.6,
        "far": 0.5544554455445545,
        "csi": 0.3435114503816794,
        "n": 494,
        "obs": 75
      }
    }
  },
  "persist": {
    "1": {
      "10": {
        "hit": 123,
        "miss": 21,
        "fa": 19,
        "cn": 331,
        "pod": 0.8541666666666666,
        "far": 0.13380281690140844,
        "csi": 0.754601226993865,
        "n": 494,
        "obs": 144
      },
      "20": {
        "hit": 114,
        "miss": 39,
        "fa": 28,
        "cn": 313,
        "pod": 0.7450980392156863,
        "far": 0.19718309859154928,
        "csi": 0.6298342541436464,
        "n": 494,
        "obs": 153
      },
      "30": {
        "hit": 106,
        "miss": 49,
        "fa": 36,
        "cn": 303,
        "pod": 0.6838709677419355,
        "far": 0.2535211267605634,
        "csi": 0.5549738219895288,
        "n": 494,
        "obs": 155
      },
      "40": {
        "hit": 101,
        "miss": 58,
        "fa": 41,
        "cn": 294,
        "pod": 0.6352201257861635,
        "far": 0.2887323943661972,
        "csi": 0.505,
        "n": 494,
        "obs": 159
      },
      "50": {
        "hit": 94,
        "miss": 62,
        "fa": 48,
        "cn": 290,
        "pod": 0.6025641025641025,
        "far": 0.3380281690140845,
        "csi": 0.46078431372549017,
        "n": 494,
        "obs": 156
      },
      "60": {
        "hit": 82,
        "miss": 66,
        "fa": 60,
        "cn": 286,
        "pod": 0.5540540540540541,
        "far": 0.4225352112676056,
        "csi": 0.3942307692307692,
        "n": 494,
        "obs": 148
      }
    },
    "2": {
      "10": {
        "hit": 66,
        "miss": 13,
        "fa": 15,
        "cn": 400,
        "pod": 0.8354430379746836,
        "far": 0.18518518518518517,
        "csi": 0.7021276595744681,
        "n": 494,
        "obs": 79
      },
      "20": {
        "hit": 54,
        "miss": 22,
        "fa": 27,
        "cn": 391,
        "pod": 0.7105263157894737,
        "far": 0.3333333333333333,
        "csi": 0.5242718446601942,
        "n": 494,
        "obs": 76
      },
      "30": {
        "hit": 47,
        "miss": 28,
        "fa": 34,
        "cn": 385,
        "pod": 0.6266666666666667,
        "far": 0.41975308641975306,
        "csi": 0.43119266055045874,
        "n": 494,
        "obs": 75
      },
      "40": {
        "hit": 43,
        "miss": 35,
        "fa": 38,
        "cn": 378,
        "pod": 0.5512820512820513,
        "far": 0.4691358024691358,
        "csi": 0.3706896551724138,
        "n": 494,
        "obs": 78
      },
      "50": {
        "hit": 36,
        "miss": 40,
        "fa": 45,
        "cn": 373,
        "pod": 0.47368421052631576,
        "far": 0.5555555555555556,
        "csi": 0.2975206611570248,
        "n": 494,
        "obs": 76
      },
      "60": {
        "hit": 33,
        "miss": 42,
        "fa": 48,
        "cn": 371,
        "pod": 0.44,
        "far": 0.5925925925925926,
        "csi": 0.2682926829268293,
        "n": 494,
        "obs": 75
      }
    }
  },
  "alerts": {
    "research": {
      "leadMin": 60,
      "minChancePct": 0,
      "byThreshold": {
        "1": {
          "skill": {
            "hit": 52,
            "miss": 41,
            "fa": 17,
            "cn": 242,
            "pod": 0.5591397849462365,
            "far": 0.2463768115942029,
            "csi": 0.4727272727272727,
            "n": 352,
            "obs": 93
          },
          "etaBiasMin": {
            "n": 52,
            "p10": -10,
            "p50": 0,
            "p90": 20
          }
        },
        "2": {
          "skill": {
            "hit": 33,
            "miss": 41,
            "fa": 24,
            "cn": 315,
            "pod": 0.44594594594594594,
            "far": 0.42105263157894735,
            "csi": 0.336734693877551,
            "n": 413,
            "obs": 74
          },
          "etaBiasMin": {
            "n": 33,
            "p10": -10,
            "p50": 5,
            "p90": 20
          }
        }
      }
    },
    "shipped": {
      "leadMin": 30,
      "minLevel": 2,
      "minChancePct": 50,
      "skill": {
        "hit": 18,
        "miss": 17,
        "fa": 16,
        "cn": 362,
        "pod": 0.5142857142857142,
        "far": 0.47058823529411764,
        "csi": 0.35294117647058826,
        "n": 413,
        "obs": 35
      },
      "etaBiasMin": {
        "n": 18,
        "p10": -10,
        "p50": 0,
        "p90": 15
      }
    }
  },
  "szansa": [
    {
      "bucket": "0-19",
      "lo": 0,
      "hi": 19,
      "n": 219,
      "meanChancePct": 10.319634703196346,
      "observedRate": 0.1004566210045662
    },
    {
      "bucket": "20-29",
      "lo": 20,
      "hi": 29,
      "n": 2,
      "meanChancePct": 22.5,
      "observedRate": 0
    },
    {
      "bucket": "30-39",
      "lo": 30,
      "hi": 39,
      "n": 0,
      "meanChancePct": 0,
      "observedRate": 0
    },
    {
      "bucket": "40-49",
      "lo": 40,
      "hi": 49,
      "n": 1,
      "meanChancePct": 40,
      "observedRate": 0
    },
    {
      "bucket": "50-59",
      "lo": 50,
      "hi": 59,
      "n": 28,
      "meanChancePct": 55,
      "observedRate": 0.17857142857142858
    },
    {
      "bucket": "60-69",
      "lo": 60,
      "hi": 69,
      "n": 75,
      "meanChancePct": 60,
      "observedRate": 0.56
    },
    {
      "bucket": "70-79",
      "lo": 70,
      "hi": 79,
      "n": 27,
      "meanChancePct": 70,
      "observedRate": 0.8888888888888888
    },
    {
      "bucket": "80-89",
      "lo": 80,
      "hi": 89,
      "n": 109,
      "meanChancePct": 80,
      "observedRate": 0.8990825688073395
    },
    {
      "bucket": "90-100",
      "lo": 90,
      "hi": 100,
      "n": 33,
      "meanChancePct": 90,
      "observedRate": 1
    }
  ]
}
```

2026-09-01 SRI (`--sri --json`, cadence-aware scorer):

```json
{
  "date": "2026-09-01",
  "runAt": "2026-09-01T15:43:08.696Z",
  "radar": {
    "from": "2026-09-01T13:45:00.000Z",
    "to": "2026-09-01T15:40:00.000Z",
    "frames": 24,
    "latestAgeSec": 189
  },
  "cellKm": [
    3
  ],
  "sampleCount": {
    "min": 4065,
    "max": 5643
  },
  "motion": {
    "allCases": 1512,
    "echoCases": 1428,
    "advectedPct": 89.07563025210084,
    "persistPct": 10.92436974789916,
    "crudeEtaPct": 0
  },
  "nowcast": {
    "1": {
      "10": {
        "hit": 285,
        "miss": 64,
        "fa": 37,
        "cn": 1042,
        "pod": 0.8166189111747851,
        "far": 0.11490683229813664,
        "csi": 0.7383419689119171,
        "n": 1428,
        "obs": 349
      },
      "20": {
        "hit": 263,
        "miss": 83,
        "fa": 84,
        "cn": 998,
        "pod": 0.7601156069364162,
        "far": 0.2420749279538905,
        "csi": 0.6116279069767442,
        "n": 1428,
        "obs": 346
      },
      "30": {
        "hit": 246,
        "miss": 97,
        "fa": 125,
        "cn": 960,
        "pod": 0.717201166180758,
        "far": 0.33692722371967654,
        "csi": 0.5256410256410257,
        "n": 1428,
        "obs": 343
      },
      "40": {
        "hit": 251,
        "miss": 85,
        "fa": 167,
        "cn": 925,
        "pod": 0.7470238095238095,
        "far": 0.39952153110047844,
        "csi": 0.4990059642147117,
        "n": 1428,
        "obs": 336
      },
      "50": {
        "hit": 246,
        "miss": 76,
        "fa": 212,
        "cn": 894,
        "pod": 0.7639751552795031,
        "far": 0.462882096069869,
        "csi": 0.4606741573033708,
        "n": 1428,
        "obs": 322
      },
      "60": {
        "hit": 228,
        "miss": 76,
        "fa": 238,
        "cn": 886,
        "pod": 0.75,
        "far": 0.5107296137339056,
        "csi": 0.42066420664206644,
        "n": 1428,
        "obs": 304
      }
    },
    "2": {
      "10": {
        "hit": 151,
        "miss": 45,
        "fa": 23,
        "cn": 1209,
        "pod": 0.7704081632653061,
        "far": 0.13218390804597702,
        "csi": 0.6894977168949772,
        "n": 1428,
        "obs": 196
      },
      "20": {
        "hit": 145,
        "miss": 48,
        "fa": 55,
        "cn": 1180,
        "pod": 0.7512953367875648,
        "far": 0.275,
        "csi": 0.5846774193548387,
        "n": 1428,
        "obs": 193
      },
      "30": {
        "hit": 134,
        "miss": 58,
        "fa": 91,
        "cn": 1145,
        "pod": 0.6979166666666666,
        "far": 0.40444444444444444,
        "csi": 0.4734982332155477,
        "n": 1428,
        "obs": 192
      },
      "40": {
        "hit": 124,
        "miss": 65,
        "fa": 119,
        "cn": 1120,
        "pod": 0.656084656084656,
        "far": 0.4897119341563786,
        "csi": 0.4025974025974026,
        "n": 1428,
        "obs": 189
      },
      "50": {
        "hit": 122,
        "miss": 56,
        "fa": 151,
        "cn": 1099,
        "pod": 0.6853932584269663,
        "far": 0.5531135531135531,
        "csi": 0.3708206686930091,
        "n": 1428,
        "obs": 178
      },
      "60": {
        "hit": 114,
        "miss": 59,
        "fa": 180,
        "cn": 1075,
        "pod": 0.6589595375722543,
        "far": 0.6122448979591837,
        "csi": 0.32294617563739375,
        "n": 1428,
        "obs": 173
      }
    }
  },
  "persist": {
    "1": {
      "10": {
        "hit": 268,
        "miss": 81,
        "fa": 83,
        "cn": 996,
        "pod": 0.7679083094555874,
        "far": 0.23646723646723647,
        "csi": 0.6203703703703703,
        "n": 1428,
        "obs": 349
      },
      "20": {
        "hit": 224,
        "miss": 122,
        "fa": 127,
        "cn": 955,
        "pod": 0.6473988439306358,
        "far": 0.36182336182336183,
        "csi": 0.47357293868921774,
        "n": 1428,
        "obs": 346
      },
      "30": {
        "hit": 193,
        "miss": 150,
        "fa": 158,
        "cn": 927,
        "pod": 0.5626822157434402,
        "far": 0.45014245014245013,
        "csi": 0.3852295409181637,
        "n": 1428,
        "obs": 343
      },
      "40": {
        "hit": 168,
        "miss": 168,
        "fa": 183,
        "cn": 909,
        "pod": 0.5,
        "far": 0.5213675213675214,
        "csi": 0.3236994219653179,
        "n": 1428,
        "obs": 336
      },
      "50": {
        "hit": 159,
        "miss": 163,
        "fa": 192,
        "cn": 914,
        "pod": 0.4937888198757764,
        "far": 0.5470085470085471,
        "csi": 0.3093385214007782,
        "n": 1428,
        "obs": 322
      },
      "60": {
        "hit": 148,
        "miss": 156,
        "fa": 203,
        "cn": 921,
        "pod": 0.4868421052631579,
        "far": 0.5783475783475783,
        "csi": 0.29191321499013806,
        "n": 1428,
        "obs": 304
      }
    },
    "2": {
      "10": {
        "hit": 146,
        "miss": 50,
        "fa": 52,
        "cn": 1180,
        "pod": 0.7448979591836735,
        "far": 0.26262626262626265,
        "csi": 0.5887096774193549,
        "n": 1428,
        "obs": 196
      },
      "20": {
        "hit": 108,
        "miss": 85,
        "fa": 90,
        "cn": 1145,
        "pod": 0.5595854922279793,
        "far": 0.45454545454545453,
        "csi": 0.38162544169611307,
        "n": 1428,
        "obs": 193
      },
      "30": {
        "hit": 87,
        "miss": 105,
        "fa": 111,
        "cn": 1125,
        "pod": 0.453125,
        "far": 0.5606060606060606,
        "csi": 0.2871287128712871,
        "n": 1428,
        "obs": 192
      },
      "40": {
        "hit": 72,
        "miss": 117,
        "fa": 126,
        "cn": 1113,
        "pod": 0.38095238095238093,
        "far": 0.6363636363636364,
        "csi": 0.22857142857142856,
        "n": 1428,
        "obs": 189
      },
      "50": {
        "hit": 66,
        "miss": 112,
        "fa": 132,
        "cn": 1118,
        "pod": 0.3707865168539326,
        "far": 0.6666666666666666,
        "csi": 0.2129032258064516,
        "n": 1428,
        "obs": 178
      },
      "60": {
        "hit": 68,
        "miss": 105,
        "fa": 130,
        "cn": 1125,
        "pod": 0.3930635838150289,
        "far": 0.6565656565656566,
        "csi": 0.22442244224422442,
        "n": 1428,
        "obs": 173
      }
    }
  },
  "alerts": {
    "research": {
      "leadMin": 60,
      "minChancePct": 0,
      "byThreshold": {
        "1": {
          "skill": {
            "hit": 205,
            "miss": 95,
            "fa": 125,
            "cn": 652,
            "pod": 0.6833333333333333,
            "far": 0.3787878787878788,
            "csi": 0.4823529411764706,
            "n": 1077,
            "obs": 300
          },
          "etaBiasMin": {
            "n": 205,
            "p10": -15,
            "p50": 0,
            "p90": 15
          }
        },
        "2": {
          "skill": {
            "hit": 179,
            "miss": 66,
            "fa": 77,
            "cn": 908,
            "pod": 0.7306122448979592,
            "far": 0.30078125,
            "csi": 0.5559006211180124,
            "n": 1230,
            "obs": 245
          },
          "etaBiasMin": {
            "n": 179,
            "p10": -15,
            "p50": 0,
            "p90": 15
          }
        }
      }
    },
    "shipped": {
      "leadMin": 30,
      "minLevel": 2,
      "minChancePct": 50,
      "skill": {
        "hit": 89,
        "miss": 50,
        "fa": 38,
        "cn": 1053,
        "pod": 0.6402877697841727,
        "far": 0.2992125984251969,
        "csi": 0.5028248587570622,
        "n": 1230,
        "obs": 139
      },
      "etaBiasMin": {
        "n": 89,
        "p10": -10,
        "p50": 0,
        "p90": 10
      }
    }
  },
  "szansa": [
    {
      "bucket": "0-19",
      "lo": 0,
      "hi": 19,
      "n": 677,
      "meanChancePct": 10,
      "observedRate": 0.10782865583456426
    },
    {
      "bucket": "20-29",
      "lo": 20,
      "hi": 29,
      "n": 23,
      "meanChancePct": 20,
      "observedRate": 0.4782608695652174
    },
    {
      "bucket": "30-39",
      "lo": 30,
      "hi": 39,
      "n": 0,
      "meanChancePct": 0,
      "observedRate": 0
    },
    {
      "bucket": "40-49",
      "lo": 40,
      "hi": 49,
      "n": 0,
      "meanChancePct": 0,
      "observedRate": 0
    },
    {
      "bucket": "50-59",
      "lo": 50,
      "hi": 59,
      "n": 268,
      "meanChancePct": 55,
      "observedRate": 0.4664179104477612
    },
    {
      "bucket": "60-69",
      "lo": 60,
      "hi": 69,
      "n": 0,
      "meanChancePct": 0,
      "observedRate": 0
    },
    {
      "bucket": "70-79",
      "lo": 70,
      "hi": 79,
      "n": 0,
      "meanChancePct": 0,
      "observedRate": 0
    },
    {
      "bucket": "80-89",
      "lo": 80,
      "hi": 89,
      "n": 0,
      "meanChancePct": 0,
      "observedRate": 0
    },
    {
      "bucket": "90-100",
      "lo": 90,
      "hi": 100,
      "n": 460,
      "meanChancePct": 90.96739130434783,
      "observedRate": 0.8804347826086957
    }
  ]
}
```
