const STORAGE_KEY = 'angmatura_device';

/**
 * Generates a random id without relying on crypto.randomUUID(), which throws
 * in non-secure contexts (plain HTTP, e.g. when testing on a phone over LAN —
 * see the `host: true` comment in vite.config.ts). Not cryptographically
 * strong, but this is only ever used as an anonymous, non-secret identifier.
 */
function generateFallbackId(): string {
	return `dev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

function generateId(): string {
	try {
		if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
			return crypto.randomUUID();
		}
	} catch {
		// crypto.randomUUID() throws in insecure contexts — fall through.
	}
	return generateFallbackId();
}

/**
 * Returns a stable, anonymous per-browser id, generating and persisting one
 * on first use. This is a pseudonymous identifier only — nothing links it to
 * a real identity, and it's never shown in the UI.
 *
 * Deliberately never throws: any failure here (missing crypto API on
 * insecure contexts, storage disabled in private browsing, etc.) would
 * otherwise crash the whole page that calls it, since this runs
 * synchronously during component initialization.
 */
export function getDeviceId(): string {
	try {
		if (typeof localStorage === 'undefined') return generateId();
		let id = localStorage.getItem(STORAGE_KEY);
		if (!id) {
			id = generateId();
			localStorage.setItem(STORAGE_KEY, id);
		}
		return id;
	} catch {
		// localStorage can throw (private browsing, disabled storage, etc.) —
		// fall back to a per-load id rather than crashing the caller.
		return generateId();
	}
}

/**
 * Mirrors the device id into a cookie so the server can read it during SSR
 * `load()` (e.g. on `/edit/[slug]`, to tell "you own this set" apart from
 * "an anonymous visitor" before the page even renders).
 *
 * Previously this same job was done by stuffing the id into the URL as
 * `?d=...`. That worked, but it meant the id — effectively "the key that
 * lets you edit this set in place" — sat right there in the address bar,
 * ready to be copy-pasted into a chat or a bug report along with everything
 * else in the URL and handed to someone else by accident. A cookie carries
 * the exact same information to the server without ever showing up
 * anywhere a person actually looks at or copies.
 *
 * Call this once per page load, from a browser-only context (a root
 * `$effect`, same as `initTheme()`). Deliberately silent on failure, same
 * reasoning as `getDeviceId()`: a cookie write that fails (e.g. cookies
 * disabled) should just mean the server falls back to treating the visitor
 * as anonymous, not crash the page.
 */
export function syncDeviceIdCookie(deviceId: string): void {
	try {
		if (typeof document === 'undefined') return;
		// 400 days is the practical cap most browsers enforce on Set-Cookie
		// max-age; SameSite=Lax is enough since this never needs to travel
		// on a cross-site request. No Secure flag, so it still works when
		// testing over plain HTTP on a phone over LAN.
		const maxAgeSeconds = 400 * 24 * 60 * 60;
		document.cookie = `${STORAGE_KEY}=${encodeURIComponent(deviceId)}; path=/; max-age=${maxAgeSeconds}; samesite=lax`;
	} catch {
		// Cookies disabled or otherwise unwritable — server will just see no
		// cookie and treat the visitor as anonymous, same as today.
	}
}
