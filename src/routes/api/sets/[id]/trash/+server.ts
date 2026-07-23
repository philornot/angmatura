import {error, json} from '@sveltejs/kit';
import type {RequestHandler} from './$types';
import {softDeleteSet, trashSetAsAdmin} from '$lib/server/repo/sets';
import {isAdminAuthed} from '$lib/server/adminAuth';

/**
 * Moves a set to the trash ("Usuń" on /my-sets and on /edit/[slug]). It
 * isn't actually deleted — it just gets `deleted_at` set and disappears
 * from every normal listing — so an admin can still recover it from
 * /admin/trash within `TRASH_RETENTION_DAYS` days.
 *
 * Same anonymous-ownership model as `/api/sets/mine`: there's no login, so
 * `deviceId` is the caller's own localStorage-backed id, and we just check it
 * against the set's recorded creator (mirrors the check in
 * `/edit/[slug]` `actions.save`). A logged-in admin may additionally trash
 * *any* set, own or not — this is what lets the "Usuń zestaw" button on
 * /edit/[slug] work there too, since an admin editing someone else's
 * original has no matching deviceId to pass.
 */
export const POST: RequestHandler = async ({params, request, cookies}) => {
	const id = Number(params.id);
	if (!Number.isInteger(id)) error(400, 'Invalid set id');

	if (isAdminAuthed(cookies)) {
		const result = trashSetAsAdmin(id);
		if (!result.ok) error(404, 'Set not found');
		return json({trashed: true});
	}

	const body = await request.json().catch(() => null);
	const deviceId = typeof body?.deviceId === 'string' ? body.deviceId : null;

	const result = softDeleteSet(id, deviceId);
	if (!result.ok) {
		if (result.error === 'not_found') error(404, 'Set not found');
		error(403, 'You are not the owner of this set.');
	}

	return json({trashed: true});
};
