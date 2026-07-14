import { fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { env } from '$env/dynamic/private';
import { getAllSets, updateSetMeta, deleteSet } from '$lib/server/repo/sets';

const COOKIE_NAME = 'angmatura_admin';

function isAuthed(cookies: import('@sveltejs/kit').Cookies): boolean {
	const value = cookies.get(COOKIE_NAME);
	return !!env.ADMIN_PASSWORD && value === env.ADMIN_PASSWORD;
}

export const load: PageServerLoad = ({ cookies }) => {
	if (!isAuthed(cookies)) {
		return { authed: false as const };
	}
	return { authed: true as const, sets: getAllSets() };
};

export const actions: Actions = {
	login: async ({ request, cookies }) => {
		const form = await request.formData();
		const password = String(form.get('password') ?? '');

		if (!env.ADMIN_PASSWORD) {
			return fail(500, { message: 'ADMIN_PASSWORD nie jest ustawione na serwerze.' });
		}
		if (password !== env.ADMIN_PASSWORD) {
			return fail(401, { message: 'Nieprawidłowe hasło.' });
		}

		cookies.set(COOKIE_NAME, password, {
			path: '/',
			httpOnly: true,
			sameSite: 'strict',
			maxAge: 60 * 60 * 24 * 30
		});
		return { loggedIn: true };
	},

	logout: async ({ cookies }) => {
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

	delete: async ({ request, cookies }) => {
		if (!isAuthed(cookies)) return fail(401, { message: 'Zaloguj się ponownie.' });
		const form = await request.formData();
		const id = Number(form.get('id'));
		deleteSet(id);
		return { deleted: true };
	}
};
