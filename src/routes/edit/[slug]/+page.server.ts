import { error, redirect, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { getSetBySlugOrCustom, updateSetMeta } from '$lib/server/repo/sets';
import { createSet } from '$lib/server/repo/sets';
import { getQuestionsForSet, replaceQuestions, type NewQuestionInput } from '$lib/server/repo/questions';

export const load: PageServerLoad = ({ params }) => {
	const set = getSetBySlugOrCustom(params.slug);
	if (!set) error(404, 'Nie znaleziono zestawu.');

	if (set.isPublic) {
		// Editing someone else's public set never mutates it in place — it forks
		// a private copy under a new slug first (spec section 9).
		const forked = createSet({
			title: `${set.title} (kopia)`,
			sourceLabel: set.sourceLabel,
			type: set.type,
			isPublic: false,
			parentSlug: set.slug
		});
		const originalQuestions = getQuestionsForSet(set.id);
		replaceQuestions(forked.id, originalQuestions);
		redirect(303, `/edit/${forked.slug}`);
	}

	const questions = getQuestionsForSet(set.id);
	return { set, questions };
};

export const actions: Actions = {
	save: async ({ params, request }) => {
		const set = getSetBySlugOrCustom(params.slug);
		if (!set) error(404, 'Nie znaleziono zestawu.');

		const form = await request.formData();
		const title = String(form.get('title') ?? '').trim();
		const sourceLabel = String(form.get('sourceLabel') ?? '').trim() || null;
		const isPublic = form.get('isPublic') === 'on';
		const questionsRaw = String(form.get('questions') ?? '[]');

		if (!title) return fail(400, { message: 'Podaj tytuł zestawu.' });

		let questions: NewQuestionInput[];
		try {
			questions = JSON.parse(questionsRaw);
		} catch {
			return fail(400, { message: 'Nieprawidłowe dane pytań.' });
		}
		if (!Array.isArray(questions) || questions.length === 0) {
			return fail(400, { message: 'Zestaw musi mieć przynajmniej jedno pytanie.' });
		}

		try {
			updateSetMeta(set.id, { title, sourceLabel, isPublic });
			replaceQuestions(set.id, questions);
		} catch (err) {
			console.error('Failed to save set', set.id, err);
			return fail(500, {
				message: 'Nie udało się zapisać zmian. Formularz nie został wyczyszczony — spróbuj ponownie.'
			});
		}

		return { message: null, saved: true };
	}
};
