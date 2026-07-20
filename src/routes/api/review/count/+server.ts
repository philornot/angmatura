import {error, json} from '@sveltejs/kit';
import type {RequestHandler} from './$types';
import {getDueQuestionsCount} from '$lib/server/repo/progress';

export const GET: RequestHandler = async ({url}) => {
    const deviceId = url.searchParams.get('deviceId');
    if (!deviceId) error(400, 'Missing deviceId');

    const count = getDueQuestionsCount(deviceId);
    return json({count});
};