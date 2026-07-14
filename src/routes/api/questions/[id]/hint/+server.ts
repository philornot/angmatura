import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getQuestionById } from '$lib/server/repo/questions';
import { recordHintUsed } from '$lib/server/repo/progress';

export const POST: RequestHandler = async ({ params, request }) => {
	const questionId = Number(params.id);
	if (!Number.isInteger(questionId)) error(400, 'Invalid question id');

	const question = getQuestionById(questionId);
	if (!question) error(404, 'Question not found');

	const body = await request.json().catch(() => null);
	const deviceId = typeof body?.deviceId === 'string' ? body.deviceId : '';
	if (deviceId) recordHintUsed(deviceId, questionId);

	const firstWord = question.correctAnswer.trim().replace(/^\(/, '');
	const firstLetter = firstWord.charAt(0).toLowerCase();
	const wordCount = question.correctAnswer
		.replace(/[()]/g, '')
		.trim()
		.split(/\s+/)
		.filter(Boolean).length;

	return json({ firstLetter, wordCount });
};
