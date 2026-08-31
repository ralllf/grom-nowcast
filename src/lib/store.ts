import { create } from "zustand";
import {
  DEFAULT_ALERT_SETTINGS,
  EMPTY_ALERT_MEMORY,
  EPISODE_TTL_MIN,
  type AlertEvent,
  type AlertMemory,
  type AlertSettings,
} from "./weather/alerts";
import { DEFAULT_PLACE } from "./weather/cities";
import { IMGW_MAP_DEFAULT, readImgwMapToggle } from "./weather/imgw-lane";
import { DRIZZLE_MAP_DEFAULT, readDrizzleToggle } from "./weather/sri-overlay";
import type { Place } from "./weather/types";

const STORAGE_KEY = "grom-settings-v1";
const ALERT_LOG_KEY = "grom-alerts-v1";
const ALERT_MEMORY_KEY = "grom-alert-memory-v1";
const ALERT_LOG_MAX = 12;

type Persisted = {
  place: Place;
  radiusKm: number;
  alerts: AlertSettings;
  /** Choropleth of powiats with an active storm warning. */
  imgwMap: boolean;
  /** Map drizzle (below klasa 1). Default off — map matches the numbers. */
  drizzleMap: boolean;
};

const DEFAULTS: Persisted = {
  place: DEFAULT_PLACE,
  radiusKm: 25,
  alerts: DEFAULT_ALERT_SETTINGS,
  imgwMap: IMGW_MAP_DEFAULT,
  drizzleMap: DRIZZLE_MAP_DEFAULT,
};

function sanitizeAlerts(raw: unknown, legacyNotify: unknown): AlertSettings {
  const a = (raw && typeof raw === "object" ? raw : {}) as Partial<AlertSettings>;
  const d = DEFAULT_ALERT_SETTINGS;
  const clampInt = (v: unknown, lo: number, hi: number, fallback: number) => {
    const n = typeof v === "number" && Number.isFinite(v) ? Math.round(v) : fallback;
    return Math.min(hi, Math.max(lo, n));
  };
  const hourOrNull = (v: unknown) =>
    typeof v === "number" && Number.isFinite(v) ? clampInt(v, 0, 23, 0) : null;
  return {
    // Older builds stored a bare `notify` flag — carry it over as "alerts on".
    enabled: typeof a.enabled === "boolean" ? a.enabled : legacyNotify === true,
    leadMin: clampInt(a.leadMin, 10, 60, d.leadMin),
    minLevel: clampInt(a.minLevel, 1, 3, d.minLevel) as AlertSettings["minLevel"],
    minChancePct: clampInt(a.minChancePct, 0, 90, d.minChancePct),
    quietFrom: hourOrNull(a.quietFrom),
    quietTo: hourOrNull(a.quietTo),
    sound: typeof a.sound === "boolean" ? a.sound : d.sound,
    allClear: typeof a.allClear === "boolean" ? a.allClear : d.allClear,
  };
}

export function loadSettings(): Persisted {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<Persisted> & { notify?: boolean };
    return {
      place: parsed.place ?? DEFAULT_PLACE,
      radiusKm: parsed.radiusKm ?? 25,
      alerts: sanitizeAlerts(parsed.alerts, parsed.notify),
      imgwMap: readImgwMapToggle(parsed.imgwMap),
      drizzleMap: readDrizzleToggle(parsed.drizzleMap),
    };
  } catch {
    return DEFAULTS;
  }
}

function loadAlertLog(): AlertEvent[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(ALERT_LOG_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as AlertEvent[]).slice(0, ALERT_LOG_MAX) : [];
  } catch {
    return [];
  }
}

function persistAlertLog(log: AlertEvent[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ALERT_LOG_KEY, JSON.stringify(log.slice(0, ALERT_LOG_MAX)));
  } catch {
    /* storage full or blocked — the log is a convenience only */
  }
}

function placeKey(p: Place) {
  return `${p.lat.toFixed(3)},${p.lon.toFixed(3)}`;
}

/** Episode memory survives a reload, but only for the same pin and only while fresh. */
function loadAlertMemory(place: Place): AlertMemory {
  if (typeof window === "undefined") return EMPTY_ALERT_MEMORY;
  try {
    const raw = window.localStorage.getItem(ALERT_MEMORY_KEY);
    if (!raw) return EMPTY_ALERT_MEMORY;
    const parsed = JSON.parse(raw) as { key?: string; savedAt?: number; memory?: AlertMemory };
    if (parsed.key !== placeKey(place)) return EMPTY_ALERT_MEMORY;
    if (
      typeof parsed.savedAt !== "number" ||
      Date.now() - parsed.savedAt > EPISODE_TTL_MIN * 60_000
    ) {
      return EMPTY_ALERT_MEMORY;
    }
    const m = parsed.memory;
    if (!m || typeof m !== "object" || !("stage" in m)) return EMPTY_ALERT_MEMORY;
    return { ...EMPTY_ALERT_MEMORY, ...m };
  } catch {
    return EMPTY_ALERT_MEMORY;
  }
}

function persistAlertMemory(place: Place, memory: AlertMemory) {
  if (typeof window === "undefined") return;
  try {
    if (memory.stage === "idle") window.localStorage.removeItem(ALERT_MEMORY_KEY);
    else
      window.localStorage.setItem(
        ALERT_MEMORY_KEY,
        JSON.stringify({ key: placeKey(place), savedAt: Date.now(), memory }),
      );
  } catch {
    /* ignore */
  }
}

type GromState = Persisted & {
  /** Alert state machine memory — mirrored to localStorage so a reload mid-storm does not re-alert. */
  alertMemory: AlertMemory;
  /** Newest first. */
  alertLog: AlertEvent[];
  /** Banner currently shown in the app (null = dismissed). */
  activeAlert: AlertEvent | null;
  setPlace: (place: Place) => void;
  updatePlaceMeta: (place: Place) => void;
  setRadiusKm: (radiusKm: number) => void;
  setImgwMap: (imgwMap: boolean) => void;
  setDrizzleMap: (drizzleMap: boolean) => void;
  setAlerts: (patch: Partial<AlertSettings>) => void;
  setAlertMemory: (memory: AlertMemory) => void;
  recordAlert: (event: AlertEvent) => void;
  dismissAlert: () => void;
  clearAlertLog: () => void;
  hydrate: () => void;
};

function persist(s: Persisted) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        place: s.place,
        radiusKm: s.radiusKm,
        alerts: s.alerts,
        imgwMap: s.imgwMap,
        drizzleMap: s.drizzleMap,
      }),
    );
  } catch {
    /* ignore */
  }
}

export const useGrom = create<GromState>((set, get) => ({
  ...DEFAULTS,
  alertMemory: EMPTY_ALERT_MEMORY,
  alertLog: [],
  activeAlert: null,
  hydrate: () => {
    const saved = loadSettings();
    set({ ...saved, alertLog: loadAlertLog(), alertMemory: loadAlertMemory(saved.place) });
  },
  setPlace: (place) => {
    // New pin = new story; do not carry an episode from another city.
    set({ place, alertMemory: EMPTY_ALERT_MEMORY, activeAlert: null });
    persist(get());
    persistAlertMemory(place, EMPTY_ALERT_MEMORY);
  },
  updatePlaceMeta: (place) => {
    set({ place });
    persist(get());
  },
  setRadiusKm: (radiusKm) => {
    set({ radiusKm });
    persist(get());
  },
  setImgwMap: (imgwMap) => {
    set({ imgwMap });
    persist(get());
  },
  setDrizzleMap: (drizzleMap) => {
    set({ drizzleMap });
    persist(get());
  },
  setAlerts: (patch) => {
    set((s) => ({ alerts: { ...s.alerts, ...patch } }));
    persist(get());
  },
  setAlertMemory: (alertMemory) => {
    set({ alertMemory });
    persistAlertMemory(get().place, alertMemory);
  },
  recordAlert: (event) =>
    set((s) => {
      const alertLog = [event, ...s.alertLog.filter((e) => e.id !== event.id)].slice(
        0,
        ALERT_LOG_MAX,
      );
      persistAlertLog(alertLog);
      return { alertLog, activeAlert: event };
    }),
  dismissAlert: () => set({ activeAlert: null }),
  clearAlertLog: () => {
    persistAlertLog([]);
    set({ alertLog: [] });
  },
}));
