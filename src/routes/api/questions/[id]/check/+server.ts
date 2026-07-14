import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { CheckResult } from '$lib/types';
import { getQuestionById } from '$lib/server/repo/questions';
import { checkAnswerForQuestion, recordStudyCheck } from '$lib/server/repo/progress';

export const POST: RequestHandler = async ({ params, request }) => {
	const questionId = Number(params.id);
	if (!Number.isInteger(questionId)) error(400, 'Invalid question id');

	const question = getQuestionById(questionId);
	if (!question) error(404, 'Question not found');

	const body = await request.json().catch(() => null);
	const given = typeof body?.given === 'string' ? body.given : '';
	const deviceId = typeof body?.deviceId === 'string' ? body.deviceId : '';

	const isCorrect = checkAnswerForQuestion(question, given);

	if (deviceId) {
		recordStudyCheck(deviceId, questionId, isCorrect);
	}

	// The AI explanation is NOT generated here — only on explicit request via
	// POST /api/questions/[id]/explain (spec 4.3 revised). We only surface
	// whatever's already cached from a previous request, if anything.
	const result: CheckResult = {
		isCorrect,
		given,
		correctAnswer: question.correctAnswer,
		alternativeAnswers: question.alternativeAnswers,
		explanation: question.explanation
	};

	return json(result);
};
