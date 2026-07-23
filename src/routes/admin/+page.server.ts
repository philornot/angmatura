import {fail} from '@sveltejs/kit';
import type {Actions, PageServerLoad} from './$types';
import {env} from '$env/dynamic/private';
import {getAllSets, setCustomSlug, trashSetAsAdmin, updateSetMeta} from '$lib/server/repo/sets';
import {
	ADMIN_COOKIE_NAME,
	createAdminSession,
	destroyAdminSession,
	isAdminAuthed,
	verifyAdminPassword
} from '$lib/server/adminAuth';
import {checkRateLimit, getClientIp, resetRateLimit} from '$lib/server/rateLimit';

const COOKIE_NAME = ADMIN_COOKIE_NAME;

// A public Cloudflare Tunnel + a password that's easy to leave as the
// example default (`change-me`) means the login form needs its own
// brute-force protection, independent of any app-wide limiter.
const LOGIN_ATTEMPT_LIMIT = 5;
const LOGIN_ATTEMPT_WINDOW_MS = 15 * 60 * 1000;

export const load: PageServerLoad = ({ cookies }) => {
	if (!isAdminAuthed(cookies)) {
		return { authed: false as const };
	}
	return { authed: true as const, sets: getAllSets() };
};

export const actions: Actions = {
	login: async ({ request, cookies, getClientAddress }) => {
		const ip = getClientIp(request, getClientAddress);
		const rateLimit = checkRateLimit('admin-login', ip, LOGIN_ATTEMPT_LIMIT, LOGIN_ATTEMPT_WINDOW_MS);
		if (!rateLimit.allowed) {
			return fail(429, {
				message: `Zbyt wiele prób logowania. Spróbuj ponownie za ${Math.ceil(rateLimit.retryAfterSeconds / 60)} min.`
			});
		}

		const form = await request.formData();
		const password = String(form.get('password') ?? '');

		if (!env.ADMIN_PASSWORD) {
			return fail(500, { message: 'ADMIN_PASSWORD nie jest ustawione na serwerze.' });
		}
		if (!verifyAdminPassword(password, env.ADMIN_PASSWORD)) {
			return fail(401, { message: 'Nieprawidłowe hasło.' });
		}

		// The session cookie is marked `Secure` below, so browsers will
		// *silently* refuse to store it over a plain http:// connection —
		// no error, no crash, the login just quietly "doesn't stick" on
		// refresh. This is exactly what happens if someone reaches the app
		// over its bare LAN IP (or any other http:// address) instead of
		// the https:// Cloudflare Tunnel hostname — easy to hit from a
		// phone on the same home network. Catching it here turns that
		// silent failure into an actual message instead of a dead button.
		//
		// Can't use `event.url.protocol` for this check: adapter-node has
		// no ORIGIN configured (see deploy.config.yaml / ecosystem.config.cjs),
		// so it only ever sees the plain-http connection cloudflared makes
		// to localhost — url.protocol would report 'http:' even for
		// legitimate https:// traffic through the tunnel. Cloudflare always
		// sets X-Forwarded-Proto to the protocol the *client* actually
		// used, so that's the header that reflects reality here (same
		// reasoning as the CF-Connecting-IP fallback in getClientIp above).
		// A request with neither header at all means cloudflared isn't in
		// the path — i.e. someone hit the Node process directly over the
		// LAN, which is also always plain http in this setup.
		const forwardedProto = request.headers.get('x-forwarded-proto');
		if (forwardedProto !== 'https') {
			return fail(400, {
				message:
					'To połączenie nie jest szyfrowane (http, nie https). Przeglądarka odrzuci plik cookie sesji. Otwórz panel pod adresem https://angmatura.pl/admin.'
			});
		}

		// Successful login: this IP no longer needs to count against the
		// attempt limit (a legitimate admin logging in repeatedly across
		// devices shouldn't get locked out).
		resetRateLimit('admin-login', ip);

		const token = createAdminSession();
		cookies.set(COOKIE_NAME, token, {
			path: '/',
			httpOnly: true,
			// Explicit rather than relying on SvelteKit's default (which
			// infers this from event.url's hostname — always true here,
			// see the forwardedProto check above for why url.protocol
			// itself can't be trusted). Written out explicitly so it's
			// obvious this is intentional, not incidental.
			secure: true,
			// 'strict' blocks the cookie from being set/sent in some mobile
			// contexts even though the app is same-site — notably Safari/iOS
			// and in-app browsers (Messages, WhatsApp, Instagram, etc.) after
			// certain navigation paths. 'lax' still fully protects this login
			// endpoint against CSRF (only "safe" cross-site GET requests skip
			// the Strict-only restriction; the cross-site POST that CSRF would
			// rely on is still blocked), so this trades no real security for
			// working mobile logins.
			sameSite: 'lax',
			maxAge: 60 * 60 * 24 * 30
		});
		return { loggedIn: true };
	},

	logout: async ({ cookies }) => {
		destroyAdminSession(cookies.get(COOKIE_NAME));
		cookies.delete(COOKIE_NAME, { path: '/' });
		return { loggedOut: true };
	},

	togglePublic: async ({ request, cookies }) => {
		if (!isAdminAuthed(cookies)) return fail(401, {message: 'Zaloguj się ponownie.'});
		const form = await request.formData();
		const id = Number(form.get('id'));
		const isPublic = form.get('isPublic') === 'true';
		updateSetMeta(id, { isPublic: !isPublic });
		return { toggled: true };
	},

	toggleFeatured: async ({ request, cookies }) => {
		if (!isAdminAuthed(cookies)) return fail(401, {message: 'Zaloguj się ponownie.'});
		const form = await request.formData();
		const id = Number(form.get('id'));
		const isFeatured = form.get('isFeatured') === 'true';
		updateSetMeta(id, { isFeatured: !isFeatured });
		return { toggled: true };
	},

	setCustomSlug: async ({ request, cookies }) => {
		if (!isAdminAuthed(cookies)) return fail(401, {message: 'Zaloguj się ponownie.'});
		const form = await request.formData();
		const id = Number(form.get('id'));
		const raw = String(form.get('customSlug') ?? '');

		const result = setCustomSlug(id, raw.trim() === '' ? null : raw);
		if (!result.ok) {
			const messages: Record<typeof result.error, string> = {
				not_public: 'Zestaw musi być najpierw opublikowany.',
				invalid: 'Nieprawidłowy link — użyj liter, cyfr i myślników.',
				taken: 'Ten link jest już zajęty przez inny zestaw.'
			};
			return fail(400, { message: messages[result.error] });
		}
		return { customSlugSet: true };
	},

	/** Moves a set to the trash — same soft-delete used by the "my sets"
	 *  self-service delete button. Recoverable from /admin/trash for
	 *  TRASH_RETENTION_DAYS days; not an immediate hard delete. */
	delete: async ({ request, cookies }) => {
		if (!isAdminAuthed(cookies)) return fail(401, {message: 'Zaloguj się ponownie.'});
		const form = await request.formData();
		const id = Number(form.get('id'));
		const result = trashSetAsAdmin(id);
		if (!result.ok) return fail(404, {message: 'Nie znaleziono zestawu.'});
		return { deleted: true };
	}
};
