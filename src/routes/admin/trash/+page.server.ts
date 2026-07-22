import {fail} from '@sveltejs/kit';
import type {Actions, PageServerLoad} from './$types';
import {deleteSet, getTrashedSets, purgeExpiredTrash, restoreSet, TRASH_RETENTION_DAYS} from '$lib/server/repo/sets';
import {isAdminAuthed} from '$lib/server/adminAuth';

export const load: PageServerLoad = ({cookies}) => {
    if (!isAdminAuthed(cookies)) {
        return {authed: false as const};
    }

    // This app has no cron/background job runner, so "purge anything past
    // its retention window whenever an admin actually opens the trash" is
    // the pragmatic stand-in for a scheduled job — it keeps the trash from
    // growing forever without needing new infrastructure.
    purgeExpiredTrash();

    return {
        authed: true as const,
        sets: getTrashedSets(),
        retentionDays: TRASH_RETENTION_DAYS
    };
};

export const actions: Actions = {
    restore: async ({request, cookies}) => {
        if (!isAdminAuthed(cookies)) return fail(401, {message: 'Zaloguj się ponownie.'});
        const form = await request.formData();
        const id = Number(form.get('id'));
        if (!Number.isInteger(id)) return fail(400, {message: 'Nieprawidłowy zestaw.'});
        restoreSet(id);
        return {restored: true};
    },

    /** Permanent, unrecoverable delete — only offered here, on a set that's
     *  already sitting in the trash, never from the main admin list. */
    destroy: async ({request, cookies}) => {
        if (!isAdminAuthed(cookies)) return fail(401, {message: 'Zaloguj się ponownie.'});
        const form = await request.formData();
        const id = Number(form.get('id'));
        if (!Number.isInteger(id)) return fail(400, {message: 'Nieprawidłowy zestaw.'});
        deleteSet(id);
        return {destroyed: true};
    }
};
