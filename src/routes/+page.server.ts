import type { PageServerLoad } from './$types';
import { getPublicSets, getFeaturedSets, groupSetsByType } from '$lib/server/repo/sets';

export const load: PageServerLoad = () => {
	const groups = groupSetsByType(getPublicSets());
	const featured = getFeaturedSets();
	return { groups, featured };
};
