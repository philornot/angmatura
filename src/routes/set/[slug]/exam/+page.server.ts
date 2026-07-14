import { error, fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { getSetBySlug } from '$lib/server/repo/sets';
import { getQuestionsForSet, toPrompt } from '$lib/server/repo/questions';
import { submitExamAttempt } from '$lib/server/repo/attempts';

export const load: PageServerLoad = ({ params }) => {
	const set = getSetBySlug(params.slug);
	if (!set) error(404, 'Nie znaleziono zestawu.');

	const questions = getQuestionsForSet(set.id).map(toPrompt);
	if (questions.length === 0) error(404, 'Ten zestaw nie ma jeszcze pytań.');

	return { set, questions };
};

export const actions: Actions = {
	default: async ({ params, request }) => {
		const set = getSetBySlug(params.slug);
		if (!set) error(404, 'Nie znaleziono zestawu.');

		const form = await request.formData();
		const given = [...form.entries()]
			.filter(([key]) => key.startsWith('q-'))
			.map(([key, value]) => ({
				questionId: Number(key.slice(2)),
				given: String(value)
			}))
			.filter((a) => Number.isInteger(a.questionId));

		if (given.length === 0) {
			return fail(400, { message: 'Uzupełnij przynajmniej jedną odpowiedź.' });
		}

		const { attempt } = submitExamAttempt(set.id, given);
		redirect(303, `/result/${attempt.slug}`);
	}
};
