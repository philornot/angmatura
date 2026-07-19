import { fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { env } from '$env/dynamic/private';
import { getAllSets, updateSetMeta, deleteSet, setCustomSlug } from '$lib/server/repo/sets';
import { createAdminSession, destroyAdminSession, isValidAdminSession, verifyAdminPassword } from '$lib/server/adminAuth';
import { checkRateLimit, getClientIp, resetRateLimit } from '$lib/server/rateLimit';

const COOKIE_NAME = 'angmatura_admin';

// A public Cloudflare Tunnel + a password that's easy to leave as the
// example default (`change-me`) means the login form needs its own
// brute-force protection, independent of any app-wide limiter.
const LOGIN_ATTEMPT_LIMIT = 5;
const LOGIN_ATTEMPT_WINDOW_MS = 15 * 60 * 1000;

function isAuthed(cookies: import('@sveltejs/kit').Cookies): boolean {
	return isValidAdminSession(cookies.get(COOKIE_NAME));
}

export const load: PageServerLoad = ({ cookies }) => {
	if (!isAuthed(cookies)) {
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

		// Successful login: this IP no longer needs to count against the
		// attempt limit (a legitimate admin logging in repeatedly across
		// devices shouldn't get locked out).
		resetRateLimit('admin-login', ip);

		const token = createAdminSession();
		cookies.set(COOKIE_NAME, token, {
			path: '/',
			httpOnly: true,
			sameSite: 'strict',
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
		if (!isAuthed(cookies)) return fail(401, { message: 'Zaloguj się ponownie.' });
		const form = await request.formData();
		const id = Number(form.get('id'));
		const isPublic = form.get('isPublic') === 'true';
		updateSetMeta(id, { isPublic: !isPublic });
		return { toggled: true };
	},

	toggleFeatured: async ({ request, cookies }) => {
		if (!isAuthed(cookies)) return fail(401, { message: 'Zaloguj się ponownie.' });
		const form = await request.formData();
		const id = Number(form.get('id'));
		const isFeatured = form.get('isFeatured') === 'true';
		updateSetMeta(id, { isFeatured: !isFeatured });
		return { toggled: true };
	},

	setCustomSlug: async ({ request, cookies }) => {
		if (!isAuthed(cookies)) return fail(401, { message: 'Zaloguj się ponownie.' });
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

	delete: async ({ request, cookies }) => {
		if (!isAuthed(cookies)) return fail(401, { message: 'Zaloguj się ponownie.' });
		const form = await request.formData();
		const id = Number(form.get('id'));
		deleteSet(id);
		return { deleted: true };
	}
};
