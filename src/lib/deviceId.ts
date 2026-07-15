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
