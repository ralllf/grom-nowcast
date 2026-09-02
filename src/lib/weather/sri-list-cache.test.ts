import assert from "node:assert/strict";
import test from "node:test";
import {
  SRI_LIST_TTL_MS,
  createSriListCache,
  type SriListStore,
} from "./sri-list-cache.ts";

const HTML = `<li><a href="x/2026083112550000dBR.sri.h5">2026083112550000dBR.sri.h5</a></li>`;

function memoryStore(): SriListStore {
  const map = new Map<string, string>();
  return {
    async get(key) {
      return map.get(key);
    },
    async set(key, value) {
      map.set(key, value);
    },
  };
}

function delayedFetch(html: string, fetches: { n: number }, gate: Promise<void>) {
  return async () => {
    fetches.n++;
    await gate;
    return html;
  };
}

test("warm listing cache: two consumers share one IMGW fetch", async () => {
  const fetches = { n: 0 };
  const getHtml = createSriListCache({
    fetchHtml: async () => {
      fetches.n++;
      return HTML;
    },
  });
  assert.equal(await getHtml(), HTML);
  assert.equal(await getHtml(), HTML);
  assert.equal(fetches.n, 1);
});

test("single-flight: two overlapping misses share one IMGW fetch", async () => {
  const fetches = { n: 0 };
  let release!: () => void;
  const gate = new Promise<void>((r) => {
    release = r;
  });
  const getHtml = createSriListCache({
    fetchHtml: delayedFetch(HTML, fetches, gate),
  });
  const a = getHtml();
  const b = getHtml();
  release();
  assert.deepEqual(await Promise.all([a, b]), [HTML, HTML]);
  assert.equal(fetches.n, 1);
});

test("shared store: a second cold cache does not re-download a fresh listing", async () => {
  const fetches = { n: 0 };
  const fetchHtml = async () => {
    fetches.n++;
    return HTML;
  };
  const shared = memoryStore();
  const first = createSriListCache({ fetchHtml, shared });
  const second = createSriListCache({ fetchHtml, shared });
  assert.equal(await first(), HTML);
  assert.equal(await second(), HTML);
  assert.equal(fetches.n, 1);
});

test("listing TTL is 90 s (SRI cadence is 5 min; matches radarScanCache)", () => {
  assert.equal(SRI_LIST_TTL_MS, 90_000);
});

test("after TTL a new consumer fetches IMGW again", async () => {
  let now = 1_000;
  const fetches = { n: 0 };
  const getHtml = createSriListCache({
    now: () => now,
    fetchHtml: async () => {
      fetches.n++;
      return HTML;
    },
  });
  assert.equal(await getHtml(), HTML);
  now += SRI_LIST_TTL_MS - 1;
  assert.equal(await getHtml(), HTML);
  assert.equal(fetches.n, 1);
  now += 2;
  assert.equal(await getHtml(), HTML);
  assert.equal(fetches.n, 2);
});
