import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDueQuestionsWithSetInfo } from '$lib/server/repo/progress';
import { toPrompt } from '$lib/server/repo/questions';

export const GET: RequestHandler = async ({ url }) => {
	const deviceId = url.searchParams.get('deviceId');
	if (!deviceId) error(400, 'Missing deviceId');

	const rows = getDueQuestionsWithSetInfo(deviceId, 15);
	return json(
		rows.map((r) => ({
			question: toPrompt(r.question),
			setType: r.setType,
			setTitle: r.setTitle,
			setSlug: r.setSlug
		}))
	);
};
