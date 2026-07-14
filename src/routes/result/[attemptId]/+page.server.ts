import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getAttemptBySlug } from '$lib/server/repo/attempts';
import { getQuestionsByIds } from '$lib/server/repo/questions';
import { getSetById } from '$lib/server/repo/sets';

export const load: PageServerLoad = ({ params }) => {
	const result = getAttemptBySlug(params.attemptId);
	if (!result) error(404, 'Nie znaleziono tego wyniku.');

	const questions = getQuestionsByIds(result.answers.map((a) => a.questionId));
	const byId = new Map(questions.map((q) => [q.id, q]));
	const set = getSetById(result.attempt.setId);

	const rows = result.answers.map((a) => ({
		given: a.given,
		isCorrect: a.isCorrect,
		question: byId.get(a.questionId)!
	}));

	return { attempt: result.attempt, rows, set };
};
