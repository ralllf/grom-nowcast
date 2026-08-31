import type { RadarLevel, Threat } from "./types.ts";
import { radarAgeCaption, radarAgeMin, wallClockMin } from "./wall-clock.ts";

/**
 * In-tab alert engine.
 *
 * Turns a stream of `Threat` snapshots (one per radar poll) into a handful of
 * human-sized events per storm *episode*:
 *
 *   idle ──incoming──▶ incoming ──now──▶ now ──allclear──▶ idle
 *     └────────now────────────────────────┘
 *
 * Each stage fires at most once per episode, so a slow front does not buzz the
 * user every hour, and a fresh cell after a lull does alert again. Pure and
 * synchronous — delivery (Notification, sound, banner) lives in the UI.
 */

export type AlertKind = "incoming" | "now" | "allclear";

export type AlertSettings = {
  enabled: boolean;
  /** Alert when the track reaches the pin within this many minutes (10–60). */
  leadMin: number;
  /** Minimum echo intensity worth an alert: 1 słaby deszcz, 2 deszcz, 3 ulewa/burza. */
  minLevel: RadarLevel;
  /** Ignore incoming tracks below this chance (%). */
  minChancePct: number;
  /** Quiet hours, local time. `null` = off. Range may wrap midnight (22 → 7). */
  quietFrom: number | null;
  quietTo: number | null;
  sound: boolean;
  /** Also tell the user when the echo has moved off the pin. */
  allClear: boolean;
};

export const DEFAULT_ALERT_SETTINGS: AlertSettings = {
  enabled: false,
  leadMin: 30,
  minLevel: 2,
  minChancePct: 50,
  quietFrom: null,
  quietTo: null,
  sound: true,
  allClear: true,
};

export type AlertEvent = {
  /** `${episode}:${kind}` — stable per episode stage, usable as Notification tag. */
  id: string;
  kind: AlertKind;
  title: string;
  body: string;
  /** Unix ms. */
  at: number;
  placeLabel: string;
  etaMin: number | null;
  level: RadarLevel;
  chancePct: number;
};

export type AlertStage = "idle" | "incoming" | "now";

export type AlertMemory = {
  episode: string | null;
  stage: AlertStage;
  /** Unix ms of the last poll that still qualified for an alert. */
  lastQualifiedAt: number | null;
  /** Unix ms since when the pin has looked clear (all-clear debounce). */
  clearSince: number | null;
  /** Whether the echo actually reached the pin in this episode. */
  hit: boolean;
};

export const EMPTY_ALERT_MEMORY: AlertMemory = {
  episode: null,
  stage: "idle",
  lastQualifiedAt: null,
  clearSince: null,
  hit: false,
};

/** Radar older than this is an outage, not a forecast — never alert on it. */
export const STALE_RADAR_MIN = 30;
/** Episode with no qualifying poll for this long fades out silently. */
export const EPISODE_TTL_MIN = 45;
/** The pin must look clear for this long before "przeszło" fires (≈2 polls). */
export const ALL_CLEAR_DEBOUNCE_MIN = 3;
/** Echo beyond this distance counts as "off the pin". */
const CLEAR_KM = 20;
const OVER_KM = 8;

export function levelNounPl(level: RadarLevel, lightningNearCell = false): string {
  if (level >= 4) return lightningNearCell ? "Gwałtowna burza" : "Ulewa";
  if (level >= 3) return lightningNearCell ? "Burza" : "Ulewa i wiatr";
  if (level >= 2) return "Deszcz";
  if (level >= 1) return "Słaby deszcz";
  return "Opad";
}

export function levelSettingLabelPl(level: RadarLevel): string {
  if (level >= 3) return "ulewa / burza";
  if (level >= 2) return "deszcz";
  return "słaby deszcz";
}

/** True when `date` falls inside the quiet-hours window (inclusive start, exclusive end). */
export function isQuietHour(
  settings: Pick<AlertSettings, "quietFrom" | "quietTo">,
  date: Date,
): boolean {
  const { quietFrom, quietTo } = settings;
  if (quietFrom === null || quietTo === null || quietFrom === quietTo) return false;
  const h = date.getHours() + date.getMinutes() / 60;
  if (quietFrom < quietTo) return h >= quietFrom && h < quietTo;
  // Wraps midnight, e.g. 22 → 7.
  return h >= quietFrom || h < quietTo;
}

function radarSuffix(
  radarTime: number | null,
  nowMs: number,
  source: "sri" | "rainviewer" = "rainviewer",
): string {
  const cap = radarAgeCaption(radarTime, nowMs, source);
  return cap ? ` ${cap}.` : "";
}

/**
 * Minutes until echo of at least `level` is over the pin, from the advected timeline;
 * falls back to the coarse ETA when there is no advected timeline. `null` = not coming.
 */
export function etaToLevel(threat: Threat, level: RadarLevel): number | null {
  if (threat.timelineAdvected && threat.timeline.length > 0) {
    const hit = threat.timeline.find((p) => p.level >= level);
    return hit ? hit.t : null;
  }
  if (threat.willHit && threat.etaMin !== null && threat.cellLevel >= level) return threat.etaMin;
  return null;
}

export type EvaluateOptions = {
  placeLabel: string;
  /** Latest radar scan time, unix seconds. `null` = no radar. */
  radarTime: number | null;
  analysisSource?: "sri" | "rainviewer";
};

export type EvaluateResult = {
  event: AlertEvent | null;
  memory: AlertMemory;
  /** Why nothing fired — handy for the settings panel. */
  reason: "disabled" | "stale" | "quiet-episode" | "fired" | "idle";
};

/**
 * Advance the alert state machine by one poll.
 * `now` is unix ms. Returns the event to deliver (if any) and the new memory.
 */
export function evaluateAlert(
  threat: Threat,
  settings: AlertSettings,
  memory: AlertMemory,
  now: number,
  opts: EvaluateOptions,
): EvaluateResult {
  if (!settings.enabled) return { event: null, memory, reason: "disabled" };

  const stale = opts.radarTime === null || now / 1000 - opts.radarTime > STALE_RADAR_MIN * 60;
  if (stale) return { event: null, memory, reason: "stale" };

  const minLevel = settings.minLevel;
  const overPin =
    threat.etaMin === 0 &&
    threat.nearestKm !== null &&
    threat.nearestKm <= OVER_KM &&
    threat.pinLevel >= minLevel;
  // ETA to the *threshold* intensity, not to the first drop: when it is already
  // drizzling (etaMin = 0) and a downpour is 20 min out, the downpour is the alert.
  // `frameEta` stays in radar-scan minutes (hindcast / timeline). `eta` is wall-clock.
  const frameEta = etaToLevel(threat, minLevel);
  const ageMin = radarAgeMin(opts.radarTime, now);
  const eta = frameEta === null ? null : wallClockMin(frameEta, ageMin);
  const incoming =
    !overPin &&
    !threat.receding &&
    frameEta !== null &&
    frameEta > 0 &&
    eta !== null &&
    eta <= settings.leadMin &&
    threat.chancePct >= settings.minChancePct;
  const qualifies = overPin || incoming;

  let mem: AlertMemory = { ...memory };

  // Fade out an episode nobody has heard from in a while (cell dissolved, tab slept).
  if (
    mem.stage !== "idle" &&
    mem.lastQualifiedAt !== null &&
    now - mem.lastQualifiedAt > EPISODE_TTL_MIN * 60_000 &&
    !qualifies
  ) {
    mem = { ...EMPTY_ALERT_MEMORY };
  }

  const arriving =
    frameEta !== null && threat.timelineAdvected
      ? threat.timeline.reduce<RadarLevel>(
          (m, p) => (p.t >= frameEta && p.t <= frameEta + 30 && p.level > m ? p.level : m),
          0,
        )
      : 0;
  const level = (
    overPin ? threat.pinLevel : Math.max(threat.cellLevel, threat.pinLevel, arriving)
  ) as RadarLevel;
  const noun = levelNounPl(level, threat.lightningNearCell);
  const lightningBit = threat.lightningNearCell ? " wyładowania w komórce." : "";
  const base = {
    at: now,
    placeLabel: opts.placeLabel,
    etaMin: overPin ? 0 : eta,
    level,
    chancePct: threat.chancePct,
  };

  if (qualifies) {
    mem.lastQualifiedAt = now;
    mem.clearSince = null;
    if (mem.stage === "idle") {
      mem.episode = String(now);
    }
    const episode = mem.episode ?? String(now);

    if (overPin && mem.stage !== "now") {
      mem.stage = "now";
      mem.hit = true;
      const expect = threat.expect ? ` Spodziewaj się: ${threat.expect}.` : "";
      return {
        memory: mem,
        reason: "fired",
        event: {
          ...base,
          id: `${episode}:now`,
          kind: "now",
          title: `${noun} nad ${opts.placeLabel}`,
          body: `Opad jest nad pinezką teraz.${expect}${lightningBit}${radarSuffix(opts.radarTime, now, opts.analysisSource)}`,
        },
      };
    }

    if (incoming && mem.stage === "idle") {
      mem.stage = "incoming";
      const from = threat.comingFrom ? `Idzie od ${threat.comingFrom}` : "Nadciąga";
      const speed = threat.speedKmh ? ` (~${Math.round(threat.speedKmh)} km/h)` : "";
      const expect = threat.expect ? ` Spodziewaj się: ${threat.expect}.` : "";
      return {
        memory: mem,
        reason: "fired",
        event: {
          ...base,
          id: `${episode}:incoming`,
          kind: "incoming",
          title: eta === 0 ? `${noun} teraz` : `${noun} za ok. ${eta} min`,
          body: `${from}${speed} na ${opts.placeLabel}. Szansa ~${threat.chancePct}%.${expect}${lightningBit}${radarSuffix(opts.radarTime, now, opts.analysisSource)}`,
        },
      };
    }

    // Same stage, same episode — stay quiet.
    return { event: null, memory: mem, reason: "quiet-episode" };
  }

  // Not qualifying.
  if (mem.stage === "idle") return { event: null, memory: mem, reason: "idle" };

  const looksClear =
    threat.nearestKm === null ||
    threat.nearestKm > CLEAR_KM ||
    (threat.receding && threat.nearestKm > OVER_KM);

  if (!looksClear) {
    // Still something around (ETA grew, cell slowed) — hold the episode open.
    mem.clearSince = null;
    return { event: null, memory: mem, reason: "quiet-episode" };
  }

  if (mem.clearSince === null) {
    mem.clearSince = now;
    return { event: null, memory: mem, reason: "quiet-episode" };
  }
  if (now - mem.clearSince < ALL_CLEAR_DEBOUNCE_MIN * 60_000) {
    return { event: null, memory: mem, reason: "quiet-episode" };
  }

  const episode = mem.episode ?? String(now);
  const hit = mem.hit;
  const next: AlertMemory = { ...EMPTY_ALERT_MEMORY };
  if (!settings.allClear) return { event: null, memory: next, reason: "quiet-episode" };

  const toward = threat.toward ? ` na ${threat.toward}` : "";
  return {
    memory: next,
    reason: "fired",
    event: {
      ...base,
      id: `${episode}:allclear`,
      kind: "allclear",
      title: `Przeszło · ${opts.placeLabel}`,
      body: hit
        ? `Opad odszedł${toward}. Radar czysty w promieniu ${CLEAR_KM} km.${radarSuffix(opts.radarTime, now, opts.analysisSource)}`
        : `Komórka minęła ${opts.placeLabel} bokiem. Radar czysty w promieniu ${CLEAR_KM} km.${radarSuffix(opts.radarTime, now, opts.analysisSource)}`,
    },
  };
}

/** Sample event for the "Testuj alert" button — exercises permission, sound and banner. */
export function testAlertEvent(placeLabel: string, now: number): AlertEvent {
  return {
    id: `test:${now}`,
    kind: "incoming",
    title: "Deszcz za ok. 18 min",
    body: `Idzie od zachodu (~40 km/h) na ${placeLabel}. Szansa ~70%. To tylko test alertu.`,
    at: now,
    placeLabel,
    etaMin: 18,
    level: 2,
    chancePct: 70,
  };
}
