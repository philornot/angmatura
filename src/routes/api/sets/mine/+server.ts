import {json} from '@sveltejs/kit';
import type {RequestHandler} from './$types';
import {getSetsByCreator} from '$lib/server/repo/sets';

/**
 * Lists the sets created from the caller's browser.
 *
 * There's no login here — `deviceId` is the anonymous, per-browser id from
 * `$lib/deviceId`, so this can only ever be called client-side with the
 * value read out of that browser's own localStorage. Missing/blank id just
 * returns an empty list rather than erroring, since a fresh browser with no
 * id yet has no sets by definition.
 */
export const GET: RequestHandler = async ({url}) => {
    const deviceId = url.searchParams.get('deviceId');
    const sets = getSetsByCreator(deviceId);
    return json(sets);
};