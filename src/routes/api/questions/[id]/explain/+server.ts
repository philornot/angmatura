import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getQuestionById, setExplanation } from '$lib/server/repo/questions';
import { getSetById } from '$lib/server/repo/sets';
import { generateExplanation } from '$lib/server/gemini';

/**
 * Generates the "why" explanation on demand — only called when the user
 * explicitly asks for it (spec 4.3 revised: no automatic AI call on every
 * check). Cached on the question after the first successful generation, so
 * repeat requests (from this or any other device) are free.
 */
export const POST: RequestHandler = async ({ params }) => {
	const questionId = Number(params.id);
	if (!Number.isInteger(questionId)) error(400, 'Invalid question id');

	const question = getQuestionById(questionId);
	if (!question) error(404, 'Question not found');

	if (question.explanation) {
		return json({ explanation: question.explanation });
	}

	const set = getSetById(question.setId);
	try {
		const explanation = await generateExplanation(question, set?.type ?? 'kwt');
		setExplanation(questionId, explanation);
		return json({ explanation });
	} catch {
		error(502, 'Nie udało się wygenerować wyjaśnienia. Spróbuj ponownie.');
	}
};
