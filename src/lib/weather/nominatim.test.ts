import assert from "node:assert/strict";
import test from "node:test";
import {
  LruCache,
  NOMINATIM_CACHE_MAX,
  NOMINATIM_MIN_GAP_MS,
  NOMINATIM_UA,
  RequestThrottle,
} from "./nominatim.ts";

test("UA names the repo and a contact mailbox", () => {
  assert.match(NOMINATIM_UA, /github.com\/ralllf\/grom-nowcast/);
  assert.match(NOMINATIM_UA, /@/);
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
