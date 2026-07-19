/**
 * Minimal in-memory rate limiter, keyed by an arbitrary string (usually a
 * client IP). Good enough for a single-process app on a Raspberry Pi — it
 * resets on every restart (`pm2 restart`), which is an acceptable trade-off
 * for the low-stakes limits it's used for here (see call sites).
 *
 * Not shared across processes/instances — if this app is ever run with
 * multiple Node processes behind a load balancer, this needs to move to a
 * shared store (e.g. the SQLite db) instead.
 */

interface Bucket {
	count: number;
	resetAt: number;
}

const buckets = new Map<string, Bucket>();

// Periodically forget old buckets so this Map doesn't grow forever on a
// long-running process getting hit by many different IPs.
const SWEEP_INTERVAL_MS = 10 * 60 * 1000;
let lastSweep = Date.now();
function sweep(now: number) {
	if (now - lastSweep < SWEEP_INTERVAL_MS) return;
	lastSweep = now;
	for (const [key, bucket] of buckets) {
		if (bucket.resetAt <= now) buckets.delete(key);
	}
}

export interface RateLimitResult {
	allowed: boolean;
	/** Seconds until the caller can retry (only meaningful when `allowed` is false). */
	retryAfterSeconds: number;
}

/**
 * Fixed-window rate limiter: allows up to `limit` calls per `windowMs` for a
 * given `key`. Each distinct `namespace` gets its own independent set of
 * buckets, so e.g. "login attempts" and "ai-generate-set requests" for the
 * same IP don't share a counter.
 */
export function checkRateLimit(
	namespace: string,
	key: string,
	limit: number,
	windowMs: number
): RateLimitResult {
	const now = Date.now();
	sweep(now);

	const bucketKey = `${namespace}:${key}`;
	const existing = buckets.get(bucketKey);

	if (!existing || existing.resetAt <= now) {
		buckets.set(bucketKey, { count: 1, resetAt: now + windowMs });
		return { allowed: true, retryAfterSeconds: 0 };
	}

	if (existing.count >= limit) {
		return { allowed: false, retryAfterSeconds: Math.ceil((existing.resetAt - now) / 1000) };
	}

	existing.count += 1;
	return { allowed: true, retryAfterSeconds: 0 };
}

/** Resets the counter for a given namespace+key (e.g. after a successful login). */
export function resetRateLimit(namespace: string, key: string): void {
	buckets.delete(`${namespace}:${key}`);
}

/**
 * Best-effort real client IP. The app runs behind a Cloudflare Tunnel
 * (`cloudflared` connects to `localhost` — see deploy.config.yaml), so
 * `event.getClientAddress()` alone would just return the loopback address
 * for every request and make per-IP limiting useless. Cloudflare always sets
 * `CF-Connecting-IP` on requests it proxies, so prefer that, then fall back
 * to `X-Forwarded-For`, then finally the raw socket address.
 */
export function getClientIp(request: Request, getClientAddress: () => string): string {
	const cfIp = request.headers.get('cf-connecting-ip');
	if (cfIp) return cfIp;

	const forwardedFor = request.headers.get('x-forwarded-for');
	if (forwardedFor) return forwardedFor.split(',')[0].trim();

	return getClientAddress();
}