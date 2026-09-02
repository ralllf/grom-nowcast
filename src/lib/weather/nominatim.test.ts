import assert from "node:assert/strict";
import test from "node:test";
import {
  ClientRateLimit,
  LruCache,
  NOMINATIM_CACHE_MAX,
  NOMINATIM_MIN_GAP_MS,
  NOMINATIM_SEARCH_THROTTLED,
  NOMINATIM_UA,
  NominatimSearchThrottled,
  RequestThrottle,
  clientKeyFromHeaders,
  isNominatimSearchThrottled,
  searchPlacesForClient,
} from "./nominatim.ts";

test("UA names the app and project URL without a personal inbox", () => {
  assert.match(NOMINATIM_UA, /GROM/);
  assert.match(NOMINATIM_UA, /grom-nowcast/);
  assert.doesNotMatch(NOMINATIM_UA, /@gmail|@inbox/i);
  assert.ok(NOMINATIM_MIN_GAP_MS >= 1100);
});

test("LRU evicts the oldest unused key", () => {
  const c = new LruCache<number>(2);
  c.set("a", 1, 1);
  c.set("b", 2, 2);
  c.set("c", 3, 3);
  assert.equal(c.size, 2);
  assert.equal(c.peek("a"), undefined);
  assert.equal(c.peek("b"), 2);
  assert.equal(c.peek("c"), 3);
});

test("get refreshes recency so a hot key is not evicted", () => {
  const c = new LruCache<number>(2);
  c.set("a", 1, 1);
  c.set("b", 2, 2);
  assert.equal(c.get("a", 3), 1);
  c.set("c", 3, 4);
  assert.equal(c.peek("a"), 1);
  assert.equal(c.peek("b"), undefined);
});

test("TTL expiry drops the entry", () => {
  const c = new LruCache<string>(NOMINATIM_CACHE_MAX);
  c.set("k", "v", 0);
  assert.equal(c.get("k", 10, 5), undefined);
});

test("expired get does not count as a hit", () => {
  const c = new LruCache<string>(8);
  c.set("k", "v", 0);
  assert.equal(c.get("k", 100, 10), undefined);
  assert.equal(c.size, 0);
});

test("throttle waits when calls are closer than the gap", async () => {
  let now = 1000;
  const slept: number[] = [];
  const gate = new RequestThrottle(
    1100,
    () => now,
    async (ms) => {
      slept.push(ms);
      now += ms;
    },
  );
  await gate.wait();
  now += 100;
  await gate.wait();
  assert.ok(slept[0] === 1100 || slept.includes(1000) || slept.some((ms) => ms >= 1000));
});

test("throttle does not sleep when the gap already passed", async () => {
  let now = 0;
  const slept: number[] = [];
  const gate = new RequestThrottle(
    1100,
    () => now,
    async (ms) => {
      slept.push(ms);
    },
  );
  await gate.wait();
  now = 2000;
  await gate.wait();
  assert.deepEqual(slept, []);
});

test("throttle serializes overlapping wait() callers", async () => {
  let now = 0;
  const gate = new RequestThrottle(
    100,
    () => now,
    async (ms) => {
      now += ms;
    },
  );
  await Promise.all([gate.wait(), gate.wait(), gate.wait()]);
  assert.ok(now >= 200);
});

function searchHarness(opts: {
  limit?: number;
  now?: () => number;
  fetchHits?: (q: string) => Promise<string[]>;
  wait?: () => Promise<void>;
}) {
  let fetches = 0;
  const cache = new LruCache<string[]>(16);
  const limiter = new ClientRateLimit(opts.limit ?? 10, 60_000, opts.now ?? (() => 0));
  const fetchHits =
    opts.fetchHits ??
    (async (q: string) => {
      fetches++;
      return [`hit:${q}`];
    });
  const gatedFetch = opts.fetchHits
    ? async (q: string) => {
        fetches++;
        return opts.fetchHits!(q);
      }
    : fetchHits;
  return {
    fetches: () => fetches,
    search: (query: string, clientId = "1.1.1.1") =>
      searchPlacesForClient(query, clientId, {
        fetchHits: gatedFetch,
        cache,
        gate: { wait: opts.wait ?? (async () => undefined) },
        limiter,
        now: opts.now ?? (() => 0),
      }),
  };
}

test("identical searches within TTL hit Nominatim once", async () => {
  const h = searchHarness({});
  const a = await h.search("Warszawa");
  const b = await h.search("  Warszawa  ");
  assert.deepEqual(a, ["hit:Warszawa"]);
  assert.deepEqual(b, a);
  assert.equal(h.fetches(), 1);
});

test("failed search is not cached", async () => {
  const h = searchHarness({
    fetchHits: async () => {
      throw new Error("502");
    },
  });
  await assert.rejects(() => h.search("Lublin"));
  await assert.rejects(() => h.search("Lublin"));
  assert.equal(h.fetches(), 2);
});

test("cached search does not take the outbound gate", async () => {
  let waits = 0;
  const h = searchHarness({
    wait: async () => {
      waits++;
    },
  });
  await h.search("Gdańsk");
  await h.search("Gdańsk");
  assert.equal(waits, 1);
  assert.equal(h.fetches(), 1);
});

test("burst from one client is rejected after the limit without extra fetches", async () => {
  const h = searchHarness({ limit: 3 });
  await h.search("aaa");
  await h.search("bbb");
  await h.search("ccc");
  await assert.rejects(() => h.search("ddd"), (err: unknown) => {
    assert.ok(err instanceof NominatimSearchThrottled);
    assert.equal(err.message, NOMINATIM_SEARCH_THROTTLED);
    return true;
  });
  assert.equal(h.fetches(), 3);
});

test("another client still has its own search budget", async () => {
  const h = searchHarness({ limit: 1 });
  await h.search("Poznań", "10.0.0.1");
  await assert.rejects(() => h.search("Opole", "10.0.0.1"), NominatimSearchThrottled);
  const other = await h.search("Opole", "10.0.0.2");
  assert.deepEqual(other, ["hit:Opole"]);
  assert.equal(h.fetches(), 2);
});

test("client key prefers the first X-Forwarded-For hop", () => {
  assert.equal(
    clientKeyFromHeaders({ "x-forwarded-for": "203.0.113.10, 10.0.0.1" }),
    "203.0.113.10",
  );
  assert.equal(clientKeyFromHeaders({ "x-real-ip": "198.51.100.7" }), "198.51.100.7");
  assert.equal(clientKeyFromHeaders({}), "anon");
});

test("serialized throttle errors still match the Polish copy", () => {
  assert.equal(isNominatimSearchThrottled(new NominatimSearchThrottled(1000)), true);
  assert.equal(isNominatimSearchThrottled({ message: NOMINATIM_SEARCH_THROTTLED }), true);
  assert.equal(isNominatimSearchThrottled(new Error("network")), false);
});
