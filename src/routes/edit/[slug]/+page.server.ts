import {error, fail, redirect} from '@sveltejs/kit';
import type {Actions, PageServerLoad} from './$types';
import {createSet, getSetBySlugOrCustom, isSetOwner, updateSetMeta} from '$lib/server/repo/sets';
import {getQuestionsForSet, type NewQuestionInput, replaceQuestions} from '$lib/server/repo/questions';

export const load: PageServerLoad = ({params, cookies}) => {
	const set = getSetBySlugOrCustom(params.slug);
	if (!set) error(404, 'Nie znaleziono zestawu.');

	// The "quiet account" system: the visitor's anonymous device id travels
	// in a cookie (mirrored there client-side by `syncDeviceIdCookie`), not
	// in the URL — so it never ends up sitting in an address bar that could
	// get copy-pasted and handed to someone else by accident. If it matches
	// the set's recorded creator, this browser made the set — it can edit
	// the original in place instead of always forking.
	const deviceId = cookies.get('angmatura_device') ?? null;
	const isOwner = isSetOwner(set, deviceId);

	if (set.isPublic && !isOwner) {
		// Editing someone else's public set never mutates it in place — it forks
		// a private copy under a new slug first (spec section 9). The fork is
		// attributed to the current visitor, so *they* can now edit it in place too.
		const forked = createSet({
			title: `${set.title} (kopia)`,
			sourceLabel: set.sourceLabel,
			type: set.type,
			isPublic: false,
			parentSlug: set.slug,
			creatorDeviceId: deviceId
		});
		const originalQuestions = getQuestionsForSet(set.id);
		replaceQuestions(forked.id, originalQuestions);
		redirect(303, `/edit/${forked.slug}`);
	}

	const questions = getQuestionsForSet(set.id);
	// Only offer the "make a fork" banner for the owner's own set — anyone
	// else already got auto-forked above, and a private set with no visible
	// owner match is being edited via its private link as before.
	const offerFork = isOwner;
	return {set, questions, isOwner, offerFork, deviceId};
};

export const actions: Actions = {
	save: async ({ params, request }) => {
		const set = getSetBySlugOrCustom(params.slug);
		if (!set) error(404, 'Nie znaleziono zestawu.');

		const form = await request.formData();
		const deviceId = String(form.get('deviceId') ?? '').trim() || null;

		// `load()` already keeps a non-owner off the original in the normal
		// browser flow (it forks and redirects them before this form ever
		// renders). But `save` is a POST to the same route, and SvelteKit
		// runs actions independently of `load` — nothing stops a request
		// from hitting `?/save` directly with an arbitrary slug, bypassing
		// that redirect entirely. A public set's slug isn't secret (it's
		// exactly the URL of the publicly listed set), so without this check
		// anyone could overwrite someone else's original in place. Private
		// sets keep the existing "the link itself is the authorization"
		// model — only public sets need the device id to match the owner.
		if (set.isPublic && !isSetOwner(set, deviceId)) {
			return fail(403, {message: 'Nie możesz edytować tego zestawu bezpośrednio — zrób jego kopię.'});
		}

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
				message: 'Nie udało się zapisać zmian. Formularz nie został wyczyszczony, spróbuj ponownie.'
			});
		}

		return { message: null, saved: true };
	},

	/** Explicit fork action, offered as a banner to owners editing their own
	 *  set — lets them experiment on a private copy without touching the
	 *  original (spec: visible banner with a button). */
	fork: async ({params, request}) => {
		const set = getSetBySlugOrCustom(params.slug);
		if (!set) error(404, 'Nie znaleziono zestawu.');

		const form = await request.formData();
		const deviceId = String(form.get('deviceId') ?? '').trim() || null;

		const forked = createSet({
			title: `${set.title} (kopia)`,
			sourceLabel: set.sourceLabel,
			type: set.type,
			isPublic: false,
			parentSlug: set.slug,
			creatorDeviceId: deviceId
		});
		const originalQuestions = getQuestionsForSet(set.id);
		replaceQuestions(forked.id, originalQuestions);

		redirect(303, `/edit/${forked.slug}`);
	}
};
