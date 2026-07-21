import crypto from 'node:crypto';
import {db} from './db';

export const ADMIN_COOKIE_NAME = 'angmatura_admin';

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days, matches the old cookie maxAge

/**
 * Creates a new random session token, stores it server-side (SQLite, so it
 * survives a `pm2 restart`), and returns the token to set as the cookie
 * value. Unlike the password itself, this token grants nothing beyond a
 * session and can be revoked/expired independently of ADMIN_PASSWORD.
 */
export function createAdminSession(): string {
	const token = crypto.randomBytes(32).toString('hex');
	const expiresAt = Date.now() + SESSION_TTL_MS;
	db.prepare('INSERT INTO admin_sessions (token, expires_at) VALUES (?, ?)').run(token, expiresAt);
	return token;
}

/** Checks whether a session token is valid (exists and not expired). */
export function isValidAdminSession(token: string | undefined): boolean {
	if (!token) return false;
	const row = db.prepare('SELECT expires_at FROM admin_sessions WHERE token = ?').get(token) as
		| { expires_at: number }
		| undefined;
	if (!row) return false;
	if (row.expires_at <= Date.now()) {
		db.prepare('DELETE FROM admin_sessions WHERE token = ?').run(token);
		return false;
	}
	return true;
}

/** Convenience wrapper reading the admin session straight off the request's
 *  cookies — shared by every admin-area route (`/admin`, `/admin/trash`) so
 *  they all agree on the same cookie name and validity check. */
export function isAdminAuthed(cookies: import('@sveltejs/kit').Cookies): boolean {
	return isValidAdminSession(cookies.get(ADMIN_COOKIE_NAME));
}

/** Removes a session token (logout). */
export function destroyAdminSession(token: string | undefined): void {
	if (!token) return;
	db.prepare('DELETE FROM admin_sessions WHERE token = ?').run(token);
}

/**
 * Constant-time comparison so a login request can't be used to guess
 * ADMIN_PASSWORD one character at a time via response-time differences.
 * Buffers must be equal length for `timingSafeEqual`, so pad both sides to
 * the longer of the two — the length check itself isn't timing-sensitive
 * (password length isn't a secret worth protecting here), only the
 * character-by-character comparison is.
 */
export function verifyAdminPassword(candidate: string, expected: string): boolean {
	const a = Buffer.from(candidate);
	const b = Buffer.from(expected);
	const len = Math.max(a.length, b.length, 1);
	const paddedA = Buffer.alloc(len);
	const paddedB = Buffer.alloc(len);
	a.copy(paddedA);
	b.copy(paddedB);
	return a.length === b.length && crypto.timingSafeEqual(paddedA, paddedB);
}
