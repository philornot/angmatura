import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getSetBySlugOrCustom } from '$lib/server/repo/sets';

export const load: PageServerLoad = ({ params }) => {
	const set = getSetBySlugOrCustom(params.slug);
	if (!set) error(404, 'Nie znaleziono zestawu.');
	return { set };
};
