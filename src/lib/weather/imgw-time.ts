const WARSAW = "Europe/Warsaw";

type Clock = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

const warsawFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: WARSAW,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function warsawClock(t: number): Clock {
  const parts = warsawFmt.formatToParts(new Date(t));
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? "0");
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

/**
 * IMGW sends `YYYY-MM-DD HH:mm:ss` in Europe/Warsaw with no offset.
 * `Date.parse("…T…")` treats that as UTC on the server and as the browser TZ
 * on the client.
 */
export function parseImgwWarsaw(raw: string): number {
  const m = raw
    .trim()
    .match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return Number.NaN;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const hour = Number(m[4]);
  const minute = Number(m[5]);
  const second = Number(m[6] ?? 0);
  const want = Date.UTC(year, month - 1, day, hour, minute, second);
  let t = want;
  for (let i = 0; i < 4; i++) {
    const c = warsawClock(t);
    const got = Date.UTC(c.year, c.month - 1, c.day, c.hour, c.minute, c.second);
    const delta = want - got;
    if (delta === 0) return t;
    t += delta;
  }
  return t;
}

export function formatImgwWhen(raw: string): string {
  const t = parseImgwWarsaw(raw);
  if (Number.isNaN(t)) return raw;
  return new Date(t).toLocaleString("pl-PL", {
    timeZone: WARSAW,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    day: "numeric",
    month: "short",
  });
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function warsawHm(t: number): string {
  const c = warsawClock(t);
  return `${pad2(c.hour)}:${pad2(c.minute)}`;
}

function civilDay(c: Clock): number {
  return Date.UTC(c.year, c.month - 1, c.day);
}

/** Relative Warsaw-day word, or null when it is neither today nor tomorrow. */
function dayWord(when: number, now: number): "dziś" | "jutro" | null {
  const delta = (civilDay(warsawClock(when)) - civilDay(warsawClock(now))) / 86_400_000;
  if (delta === 0) return "dziś";
  if (delta === 1) return "jutro";
  return null;
}

/** Time-boxed IMGW window: "dziś 14:00–22:00", else falls back to formatImgwWhen. */
export function formatImgwRange(fromRaw: string, toRaw: string, now = Date.now()): string {
  const from = parseImgwWarsaw(fromRaw);
  const to = parseImgwWarsaw(toRaw);
  if (Number.isNaN(from) || Number.isNaN(to)) {
    return `${formatImgwWhen(fromRaw)} – ${formatImgwWhen(toRaw)}`;
  }
  const fromDay = dayWord(from, now);
  const toDay = dayWord(to, now);
  const fromHm = warsawHm(from);
  const toHm = warsawHm(to);
  if (fromDay && toDay && fromDay === toDay) return `${fromDay} ${fromHm}–${toHm}`;
  if (fromDay && toDay) return `${fromDay} ${fromHm} – ${toDay} ${toHm}`;
  return `${formatImgwWhen(fromRaw)} – ${formatImgwWhen(toRaw)}`;
}

export function isActiveWarning(from: string, to: string, now = Date.now()): boolean {
  const start = parseImgwWarsaw(from);
  const end = parseImgwWarsaw(to);
  if (Number.isNaN(start) || Number.isNaN(end)) return true;
  return now >= start - 30 * 60_000 && now <= end;
}
