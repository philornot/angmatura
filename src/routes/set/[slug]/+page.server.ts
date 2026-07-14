import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getSetBySlug } from '$lib/server/repo/sets';

export const load: PageServerLoad = ({ params }) => {
	const set = getSetBySlug(params.slug);
	if (!set) error(404, 'Nie znaleziono zestawu.');
	return { set };
};
