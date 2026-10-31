/**
 * Best-effort protection for a free-tier deployment.
 *
 * State lives in this serverless instance's memory, so it resets on cold starts
 * and is not shared between instances. It stops casual hammering; for real
 * enforcement also add a rate-limit rule in Vercel Firewall (Project > Firewall)
 * or use Upstash Ratelimit.
 */
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 6;
const MAX_CONCURRENT = 3;

const hits = new Map<string, number[]>();
let running = 0;

export function checkRateLimit(ip: string, now = Date.now()): { ok: true } | { ok: false; retryAfterSec: number } {
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) {
    return { ok: false, retryAfterSec: Math.ceil((WINDOW_MS - (now - recent[0])) / 1000) };
  }
  recent.push(now);
  hits.set(ip, recent);
  // Keep the map from growing without bound.
  if (hits.size > 5000) for (const [k, v] of hits) if (v.every((t) => now - t >= WINDOW_MS)) hits.delete(k);
  return { ok: true };
}

/** Returns a release function, or null when the instance is already busy. */
export function acquireSlot(): (() => void) | null {
  if (running >= MAX_CONCURRENT) return null;
  running++;
  let released = false;
  return () => {
    if (!released) { released = true; running--; }
  };
}

export function clientIp(headers: Headers): string {
  return headers.get("x-real-ip") ?? headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}