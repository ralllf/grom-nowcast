export const NOMINATIM_UA =
  "GROM/0.1 (+https://github.com/ralllf/grom-nowcast; strzelczyk.rafal@gmail.com)";
export const NOMINATIM_MIN_GAP_MS = 1_100;
export const NOMINATIM_CACHE_MAX = 200;
export const NOMINATIM_CACHE_TTL_MS = 60 * 60_000;

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
