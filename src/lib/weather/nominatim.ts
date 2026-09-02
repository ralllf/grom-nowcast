export const NOMINATIM_UA =
  "GROM/0.1 (+https://grom-nowcast.vercel.app/; https://github.com/ralllf/grom-nowcast)";
export const NOMINATIM_MIN_GAP_MS = 1_100;
export const NOMINATIM_CACHE_MAX = 200;
export const NOMINATIM_CACHE_TTL_MS = 60 * 60_000;
export const NOMINATIM_SEARCH_LIMIT = 10;
export const NOMINATIM_SEARCH_WINDOW_MS = 60_000;
export const NOMINATIM_SEARCH_THROTTLED = "Za dużo wyszukiwań. Spróbuj za chwilę.";

export class LruCache<V> {
  readonly max: number;
  private readonly map = new Map<string, { at: number; value: V }>();

  constructor(max: number) {
    this.max = max;
  }

  get size() {
    return this.map.size;
  }

  peek(key: string): V | undefined {
    return this.map.get(key)?.value;
  }

  get(key: string, now = Date.now(), ttlMs = NOMINATIM_CACHE_TTL_MS): V | undefined {
    const hit = this.map.get(key);
    if (!hit) return undefined;
    if (now - hit.at > ttlMs) {
      this.map.delete(key);
      return undefined;
    }
    this.map.delete(key);
    this.map.set(key, hit);
    return hit.value;
  }

  set(key: string, value: V, now = Date.now()): void {
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, { at: now, value });
    while (this.map.size > this.max) {
      const oldest = this.map.keys().next().value;
      if (oldest === undefined) break;
      this.map.delete(oldest);
    }
  }
}

export class RequestThrottle {
  readonly minGapMs: number;
  private last = Number.NEGATIVE_INFINITY;
  private chain: Promise<void> = Promise.resolve();
  private readonly now: () => number;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(
    minGapMs: number,
    now: () => number = Date.now,
    sleep: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms)),
  ) {
    this.minGapMs = minGapMs;
    this.now = now;
    this.sleep = sleep;
  }

  async wait(): Promise<void> {
    const run = this.chain.then(async () => {
      const gap = this.minGapMs - (this.now() - this.last);
      if (gap > 0) await this.sleep(gap);
      this.last = this.now();
    });
    this.chain = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }
}

export class NominatimSearchThrottled extends Error {
  readonly retryAfterMs: number;
  constructor(retryAfterMs: number) {
    super(NOMINATIM_SEARCH_THROTTLED);
    this.name = "NominatimSearchThrottled";
    this.retryAfterMs = retryAfterMs;
  }
}

/** Sliding window, per client key. In-process — same lifetime as nominatimGate. */
export class ClientRateLimit {
  readonly max: number;
  readonly windowMs: number;
  private readonly hits = new Map<string, number[]>();
  private readonly now: () => number;

  constructor(max: number, windowMs: number, now: () => number = Date.now) {
    this.max = max;
    this.windowMs = windowMs;
    this.now = now;
  }

  take(clientId: string): { ok: true } | { ok: false; retryAfterMs: number } {
    const t = this.now();
    const windowStart = t - this.windowMs;
    const prev = (this.hits.get(clientId) ?? []).filter((at) => at > windowStart);
    if (prev.length >= this.max) {
      this.hits.set(clientId, prev);
      const retryAfterMs = Math.max(1, prev[0]! + this.windowMs - t);
      return { ok: false, retryAfterMs };
    }
    prev.push(t);
    this.hits.set(clientId, prev);
    if (this.hits.size > 2_000) this.prune(windowStart);
    return { ok: true };
  }

  private prune(windowStart: number): void {
    for (const [key, times] of this.hits) {
      if (times.length === 0 || times[times.length - 1]! <= windowStart) {
        this.hits.delete(key);
      }
    }
  }
}

export function clientKeyFromHeaders(
  headers: Headers | Record<string, string | undefined | null>,
): string {
  const read = (name: string): string | undefined => {
    if (headers instanceof Headers) return headers.get(name) ?? undefined;
    const direct = headers[name];
    if (direct) return direct;
    const want = name.toLowerCase();
    for (const [key, value] of Object.entries(headers)) {
      if (key.toLowerCase() === want && value) return value;
    }
    return undefined;
  };
  const forwarded = read("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = read("x-real-ip")?.trim();
  if (realIp) return realIp;
  return "anon";
}

export function searchKey(query: string): string | null {
  const key = query.trim().toLowerCase();
  return key.length < 2 ? null : key;
}

export function isNominatimSearchThrottled(err: unknown): boolean {
  if (err instanceof NominatimSearchThrottled) return true;
  if (typeof err === "object" && err && "message" in err) {
    return String((err as { message: unknown }).message).includes(NOMINATIM_SEARCH_THROTTLED);
  }
  return typeof err === "string" && err.includes(NOMINATIM_SEARCH_THROTTLED);
}

export type NominatimSearchDeps<T> = {
  fetchHits: (q: string) => Promise<T>;
  cache: LruCache<T>;
  gate: { wait(): Promise<void> };
  limiter: ClientRateLimit;
  now?: () => number;
};

export async function searchPlacesForClient<T>(
  query: string,
  clientId: string,
  deps: NominatimSearchDeps<T>,
): Promise<T> {
  const allowed = deps.limiter.take(clientId);
  if (!allowed.ok) throw new NominatimSearchThrottled(allowed.retryAfterMs);
  const key = searchKey(query);
  if (!key) return [] as T;
  const now = deps.now ?? Date.now;
  const hit = deps.cache.get(key, now());
  if (hit !== undefined) return hit;
  await deps.gate.wait();
  const again = deps.cache.get(key, now());
  if (again !== undefined) return again;
  const value = await deps.fetchHits(query.trim());
  deps.cache.set(key, value, now());
  return value;
}
