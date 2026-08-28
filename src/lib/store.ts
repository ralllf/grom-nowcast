import { create } from "zustand";
import { DEFAULT_PLACE } from "./weather/cities";
import type { Place, RadarMemoryFrame } from "./weather/types";

const STORAGE_KEY = "grom-settings-v1";

type Persisted = {
  place: Place;
  radiusKm: number;
  notify: boolean;
};

export function loadSettings(): Persisted {
  if (typeof window === "undefined") {
    return { place: DEFAULT_PLACE, radiusKm: 25, notify: false };
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { place: DEFAULT_PLACE, radiusKm: 25, notify: false };
    const parsed = JSON.parse(raw) as Partial<Persisted>;
    return {
      place: parsed.place ?? DEFAULT_PLACE,
      radiusKm: parsed.radiusKm ?? 25,
      notify: parsed.notify ?? false,
    };
  } catch {
    return { place: DEFAULT_PLACE, radiusKm: 25, notify: false };
  }
}

type GromState = Persisted & {
  frames: RadarMemoryFrame[];
  lastNotified: string | null;
  setPlace: (place: Place) => void;
  updatePlaceMeta: (place: Place) => void;
  setRadiusKm: (radiusKm: number) => void;
  setNotify: (notify: boolean) => void;
  pushFrame: (frame: RadarMemoryFrame) => void;
  markNotified: (key: string) => void;
  hydrate: () => void;
};

function persist(s: Pick<GromState, "place" | "radiusKm" | "notify">) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ place: s.place, radiusKm: s.radiusKm, notify: s.notify }),
  );
}

export const useGrom = create<GromState>((set, get) => ({
  place: DEFAULT_PLACE,
  radiusKm: 25,
  notify: false,
  frames: [],
  lastNotified: null,
  hydrate: () => {
    const saved = loadSettings();
    set({ ...saved });
  },
  setPlace: (place) => {
    set({ place, frames: [] });
    persist(get());
  },
  updatePlaceMeta: (place) => {
    set({ place });
    persist(get());
  },
  setRadiusKm: (radiusKm) => {
    set({ radiusKm, frames: [] });
    persist(get());
  },
  setNotify: (notify) => {
    set({ notify });
    persist(get());
  },
  pushFrame: (frame) =>
    set((s) => {
      const without = s.frames.filter((f) => f.time !== frame.time);
      const frames = [...without, frame].sort((a, b) => a.time - b.time).slice(-6);
      return { frames };
    }),
  markNotified: (key) => set({ lastNotified: key }),
}));
