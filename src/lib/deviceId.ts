const STORAGE_KEY = 'angmatura_device';

/**
 * Returns a stable, anonymous per-browser id, generating and persisting one
 * on first use. This is a pseudonymous identifier only — nothing links it to
 * a real identity, and it's never shown in the UI.
 */
export function getDeviceId(): string {
	if (typeof localStorage === 'undefined') return '';
	let id = localStorage.getItem(STORAGE_KEY);
	if (!id) {
		id = crypto.randomUUID();
		localStorage.setItem(STORAGE_KEY, id);
	}
	return id;
}
