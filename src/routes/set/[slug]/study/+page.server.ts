import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getSetBySlug } from '$lib/server/repo/sets';
import { getQuestionsForSet, toPrompt } from '$lib/server/repo/questions';

export const load: PageServerLoad = ({ params }) => {
	const set = getSetBySlug(params.slug);
	if (!set) error(404, 'Nie znaleziono zestawu.');

	const questions = getQuestionsForSet(set.id).map(toPrompt);
	if (questions.length === 0) error(404, 'Ten zestaw nie ma jeszcze pytań.');

	return { set, questions };
};
