import {error, json} from '@sveltejs/kit';
import type {RequestHandler} from './$types';
import {isAdminAuthed} from '$lib/server/adminAuth';
import {deleteSet, getSetById, restoreSet, trashSetAsAdmin, updateSetMeta} from '$lib/server/repo/sets';

type BulkAction = 'publish' | 'hide' | 'feature' | 'unfeature' | 'trash' | 'restore' | 'destroy';

const VALID_ACTIONS: BulkAction[] = ['publish', 'hide', 'feature', 'unfeature', 'trash', 'restore', 'destroy'];

/**
 * Applies one action to several sets at once, for the admin panel's bulk
 * selection toolbar (main list) and the trash screen's bulk toolbar. Each
 * action sets an explicit target state (e.g. "publish" always ends with
 * isPublic = true) rather than toggling each set's current value
 * independently — with a mixed selection (some public, some not) a per-item
 * toggle would leave the outcome unpredictable, while "make all of these
 * public" always does the same thing regardless of where each one started.
 *
 * "feature" is skipped (not failed) for any set that isn't public, mirroring
 * the single-set button's disabled state — a set can't be featured while
 * hidden. "trash"/"restore"/"destroy" always succeed per set regardless of
 * public/featured state, matching their existing single-set equivalents.
 * "destroy" is a hard, unrecoverable delete — only ever offered on sets
 * already sitting in the trash.
 */
export const POST: RequestHandler = async ({request, cookies}) => {
    if (!isAdminAuthed(cookies)) error(401, 'Zaloguj się ponownie.');

    const body = await request.json().catch(() => null);
    const ids = Array.isArray(body?.ids) ? body.ids.filter((id: unknown) => Number.isInteger(id)) : [];
    const action = body?.action as BulkAction | undefined;

    if (ids.length === 0) error(400, 'Brak zestawów do zaktualizowania.');
    if (!action || !VALID_ACTIONS.includes(action)) error(400, 'Nieznana akcja.');

    let skipped = 0;
    for (const id of ids) {
        switch (action) {
            case 'publish':
                updateSetMeta(id, {isPublic: true});
                break;
            case 'hide':
                updateSetMeta(id, {isPublic: false, isFeatured: false});
                break;
            case 'feature':
            case 'unfeature': {
                // Mirrors the single-set button: featuring a hidden set isn't
                // possible, so we quietly skip it rather than erroring out the
                // whole batch over one ineligible set.
                const current = getSetById(id);
                if (action === 'feature' && !current?.isPublic) {
                    skipped++;
                    break;
                }
                updateSetMeta(id, {isFeatured: action === 'feature'});
                break;
            }
            case 'trash':
                trashSetAsAdmin(id);
                break;
            case 'restore':
                restoreSet(id);
                break;
            case 'destroy':
                deleteSet(id);
                break;
        }
    }

    return json({ok: true, updated: ids.length - skipped, skipped});
};
