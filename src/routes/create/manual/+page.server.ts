import {fail, redirect} from '@sveltejs/kit';
import type {Actions} from './$types';
import {createSet} from '$lib/server/repo/sets';
import {insertQuestions, type NewQuestionInput} from '$lib/server/repo/questions';
import type {SetType} from '$lib/types';

export const actions: Actions = {
	save: async ({ request }) => {
		const form = await request.formData();
		const title = String(form.get('title') ?? '').trim();
		const sourceLabel = String(form.get('sourceLabel') ?? '').trim() || null;
		const type = String(form.get('type') ?? 'kwt') as SetType;
		const isPublic = form.get('isPublic') === 'on';
		const questionsRaw = String(form.get('questions') ?? '[]');
		const deviceId = String(form.get('deviceId') ?? '').trim() || null;

		if (!title) {
			return fail(400, { message: 'Podaj tytuł zestawu.' });
		}

		let questions: NewQuestionInput[];
		try {
			questions = JSON.parse(questionsRaw);
		} catch {
			return fail(400, { message: 'Nieprawidłowe dane pytań.' });
		}
		if (!Array.isArray(questions) || questions.length === 0) {
			return fail(400, { message: 'Zestaw musi mieć przynajmniej jedno pytanie.' });
		}
		if (questions.some((q) => !q.sentence2WithGap?.trim() || !q.correctAnswer?.trim())) {
			return fail(400, { message: 'Każde pytanie musi mieć zdanie z luką i poprawną odpowiedź.' });
		}

		const set = createSet({title, sourceLabel, type, isPublic, creatorDeviceId: deviceId});
		insertQuestions(set.id, questions);
		redirect(303, `/set/${set.slug}?created=1`);
	}
};
