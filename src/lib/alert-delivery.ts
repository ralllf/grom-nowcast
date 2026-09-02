import { prefersReducedMotion, titleFlashIntervalMs } from "./reduced-motion";
import type { AlertEvent, AlertKind } from "./weather/alerts";

/**
 * Browser-side delivery for in-tab alerts: OS notification, a short chime and a
 * flashing tab title. No service worker, no push — this only works while the
 * GROM tab is open (foreground or background).
 */

export type NotifyPermission = "granted" | "denied" | "default" | "unsupported";

export function notifyPermission(): NotifyPermission {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission;
}

export async function requestNotifyPermission(): Promise<NotifyPermission> {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

export function showOsNotification(event: AlertEvent) {
  if (notifyPermission() !== "granted") return;
  try {
    const n = new Notification(`GROM · ${event.title}`, {
      body: event.body,
      // Same episode+stage replaces itself instead of stacking.
      tag: event.id,
      icon: "/favicon.svg",
      requireInteraction: event.kind === "now",
      silent: true, // we play our own chime (respects the sound setting)
    });
    n.onclick = () => {
      try {
        window.focus();
      } catch {
        /* ignore */
      }
      n.close();
    };
  } catch {
    /* Some browsers throw for non-persistent notifications; the banner still shows. */
  }
}

let audioCtx: AudioContext | null = null;

function getAudio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  audioCtx ??= new Ctor();
  return audioCtx;
}

/** Call from a user gesture (toggle / test button) so later chimes are allowed. */
export function primeSound() {
  const ctx = getAudio();
  if (ctx && ctx.state === "suspended") void ctx.resume().catch(() => {});
}

const CHIME: Record<AlertKind, number[]> = {
  incoming: [660, 880],
  now: [880, 660, 880],
  allclear: [523],
};

export function playChime(kind: AlertKind) {
  const ctx = getAudio();
  if (!ctx) return;
  // Autoplay policy: without a prior gesture the context stays suspended and the
  // scheduled tones are simply never heard — nothing to handle.
  if (ctx.state === "suspended") void ctx.resume().catch(() => {});
  const t0 = ctx.currentTime + 0.02;
  CHIME[kind].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    const start = t0 + i * 0.18;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.18, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.16);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + 0.18);
  });
}

let flashTimer: number | null = null;
let baseTitle: string | null = null;
let stopFlashAt = 0;

export function stopTitleFlash() {
  if (typeof document === "undefined") return;
  if (flashTimer !== null) {
    window.clearInterval(flashTimer);
    flashTimer = null;
  }
  if (baseTitle !== null) {
    document.title = baseTitle;
    baseTitle = null;
  }
}

/** Alternate the tab title with the alert for up to 5 minutes or until the tab is focused. */
export function startTitleFlash(event: AlertEvent) {
  if (typeof document === "undefined") return;
  stopTitleFlash();
  if (prefersReducedMotion()) return;
  const interval = titleFlashIntervalMs(false);
  baseTitle = document.title;
  stopFlashAt = Date.now() + 5 * 60_000;
  const alt = `⚡ ${event.title}`;
  let on = false;
  flashTimer = window.setInterval(() => {
    if (Date.now() > stopFlashAt || document.visibilityState === "visible") {
      stopTitleFlash();
      return;
    }
    on = !on;
    document.title = on ? alt : (baseTitle ?? document.title);
  }, interval);
}

export type DeliveryOptions = {
  sound: boolean;
  /** Quiet hours: banner only, no OS notification, no chime. */
  quiet: boolean;
};

export function deliverAlert(event: AlertEvent, opts: DeliveryOptions) {
  if (typeof window === "undefined") return;
  if (opts.quiet) return;
  showOsNotification(event);
  if (opts.sound) playChime(event.kind);
  if (document.visibilityState !== "visible") startTitleFlash(event);
}
