/**
 * Shared COMPO_SRI datastore listing.
 *
 * IMGW cadence is 5 min. 90 s is 2× the old per-isolate 45 s RAM TTL — still
 * well under one product cycle, so a new `.sri.h5` is seen on the next scan
 * window, and it matches the existing 90 s radarScanCache so snapshot + overlay
 * share one listing. The 7.7 s / 968 KB POST must not run once per Vercel isolate.
 *
 * Layers: in-process TTL + single-flight, then Vercel Runtime Cache (no env,
 * not Redis/KV) when `getCache` is available. Off-platform (Vite, tests) the
 * shared layer is a no-op.
 */
import { getCache } from "@vercel/functions";

export const SRI_LIST_TTL_MS = 90_000;
export const SRI_LIST_CACHE_KEY = "grom:compo-sri:listing";

export type SriListStore = {
  get(key: string): Promise<string | undefined>;
  set(key: string, value: string, ttlMs: number): Promise<void>;
};

export type SriListCacheOptions = {
  fetchHtml: () => Promise<string>;
  shared?: SriListStore;
  now?: () => number;
  log?: (event: "hit" | "miss" | "coalesce" | "shared-hit") => void;
};

export function createSriListCache(opts: SriListCacheOptions): () => Promise<string> {
  let mem: { at: number; html: string } | null = null;
  let inflight: Promise<string> | null = null;
  const now = opts.now ?? Date.now;

  return function getSriListingHtml(): Promise<string> {
    const t = now();
    if (mem && t - mem.at < SRI_LIST_TTL_MS) {
      opts.log?.("hit");
      return Promise.resolve(mem.html);
    }
    if (inflight) {
      opts.log?.("coalesce");
      return inflight;
    }
    inflight = loadListing(t).finally(() => {
      inflight = null;
    });
    return inflight;
  };

  async function loadListing(t: number): Promise<string> {
    if (opts.shared) {
      try {
        const cached = await opts.shared.get(SRI_LIST_CACHE_KEY);
        if (cached) {
          mem = { at: t, html: cached };
          opts.log?.("shared-hit");
          return cached;
        }
      } catch {
        // Runtime Cache is optional; fall through to IMGW.
      }
    }
    opts.log?.("miss");
    const html = await opts.fetchHtml();
    mem = { at: t, html };
    if (opts.shared) {
      try {
        await opts.shared.set(SRI_LIST_CACHE_KEY, html, SRI_LIST_TTL_MS);
      } catch {
        // Keep the in-process hit even if the shared write fails.
      }
    }
    return html;
  }
}

/** Vercel Runtime Cache when the platform provides it; otherwise undefined. */
export function tryVercelSriListStore(): SriListStore | undefined {
  try {
    const cache = getCache();
    return {
      async get(key) {
        const value = await cache.get(key);
        return typeof value === "string" ? value : undefined;
      },
      async set(key, value, ttlMs) {
        await cache.set(key, value, { ttl: Math.ceil(ttlMs / 1000), name: "sri-list" });
      },
    };
  } catch {
    return undefined;
  }
}
