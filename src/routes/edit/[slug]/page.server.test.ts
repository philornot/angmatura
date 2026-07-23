import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import Database from 'better-sqlite3';
import {initSchema} from '$lib/server/schema';

// Integration test against a real (in-memory) SQLite database — same
// pattern as `progress.test.ts`. A pure unit test of `isSetOwner()` alone
// wouldn't catch this: the bug isn't in that function, it's that one of the
// two code paths that mutate a set never calls it at all.
//
// Context: the visitor's anonymous device id — mirrored into a cookie
// client-side by `syncDeviceIdCookie` — is how the server tells "this
// browser owns this set" apart from "an anonymous visitor". `load()` uses it
// correctly — a non-owner hitting a public set's edit page gets forked onto
// a private copy instead of touching the original. But `actions.save` is a
// separate entry point (a raw POST to the same route) that SvelteKit does
// NOT gate behind `load()` first. If `save` doesn't independently re-check
// ownership, anyone who knows a set's slug — which is public knowledge for
// any publicly-listed set — can overwrite the original in place by posting
// directly to the `save` action, completely bypassing the fork-on-view
// protection. That's exactly the kind of "unauthorized access to someone
// else's set" this suite exists to catch: a missing check in `load()` and a
// missing check in `save` are different bugs, but both let a stranger's
// click end up mutating (or claiming) someone else's original.
let testDb: Database.Database;

function makeFormData(fields: Record<string, string>): FormData {
    const form = new FormData();
    for (const [key, value] of Object.entries(fields)) form.append(key, value);
    return form;
}

beforeEach(() => {
    vi.resetModules();
    testDb = new Database(':memory:');
    testDb.pragma('foreign_keys = ON');
    initSchema(testDb);
    vi.doMock('$lib/server/db', () => ({db: testDb}));

    // A public set created by device "owner-device". Its slug is not a
    // secret — it's exactly what shows up in the URL of the publicly listed
    // set, so anyone can type/curl `/edit/<slug>`.
    testDb
        .prepare(
            `INSERT INTO sets (id, slug, title, type, is_public, creator_device_id)
             VALUES (1, 'public-set', 'Original title', 'kwt', 1, 'owner-device')`
        )
        .run();
    testDb
        .prepare(
            `INSERT INTO questions (id, set_id, position, sentence1, sentence2_with_gap, keyword,
                                    correct_answer, alternative_answers, example_wrong_answers,
                                    grammar_tags, min_words, max_words)
             VALUES (1, 1, 1, 'He is happy.', 'He ______ happy.', 'be', 'is', '[]', '[]', '[]', 1, 1)`
        )
        .run();
});

afterEach(() => {
    testDb.close();
    vi.doUnmock('$lib/server/db');
});

describe('edit/[slug] authorization (integration, real SQLite)', () => {
    it('load() forks a public set for a visitor whose device id does not match the owner', async () => {
        const {load} = await import('./+page.server');

        let redirected: unknown;
        try {
            await load({
                params: {slug: 'public-set'},
                cookies: {get: () => 'attacker-device'}
            } as unknown as Parameters<typeof load>[0]);
        } catch (e) {
            redirected = e;
        }

        // SvelteKit's redirect() throws; a thrown value with a 3xx status is
        // the expected "you got forked, not let in" outcome.
        expect(redirected).toBeDefined();
        expect((redirected as { status: number }).status).toBe(303);

        // The original must be completely untouched.
        const {getSetBySlugOrCustom} = await import('$lib/server/repo/sets');
        const original = getSetBySlugOrCustom('public-set');
        expect(original?.title).toBe('Original title');
        expect(original?.creatorDeviceId).toBe('owner-device');
    });

    it("actions.save rejects a request that doesn't belong to the set's owner, instead of mutating the original", async () => {
        const {actions} = await import('./+page.server');

        const maliciousForm = makeFormData({
            title: 'HACKED',
            isPublic: 'on',
            questions: JSON.stringify([
                {
                    sentence1: 'x',
                    sentence2WithGap: 'y ______ z',
                    keyword: 'k',
                    correctAnswer: 'defaced',
                    alternativeAnswers: [],
                    exampleWrongAnswers: [],
                    grammarTags: [],
                    minWords: 1,
                    maxWords: 1
                }
            ]),
            // The attacker doesn't know (or lies about) the owner's device id.
            deviceId: 'attacker-device'
        });

        const result = await actions.save({
            params: {slug: 'public-set'},
            request: {formData: async () => maliciousForm} as unknown as Request,
            cookies: {get: () => undefined}
        } as unknown as Parameters<typeof actions.save>[0]);

        // fail() returns an ActionFailure with a `status` property rather
        // than throwing — assert the request was explicitly rejected.
        expect((result as { status?: number } | undefined)?.status).toBe(403);

        const {getSetBySlugOrCustom} = await import('$lib/server/repo/sets');
        const {getQuestionsForSet} = await import('$lib/server/repo/questions');
        const afterAttempt = getSetBySlugOrCustom('public-set');

        expect(afterAttempt?.title).toBe('Original title');
        expect(getQuestionsForSet(afterAttempt!.id).map((q) => q.correctAnswer)).toEqual(['is']);
    });

    it("load() reports a fork as a fork, not as the original, when its owner (who just forked it) revisits its edit page", async () => {
        const {actions, load} = await import('./+page.server');

        // Owner explicitly forks their own set via the "make a copy" banner.
        const forkForm = makeFormData({deviceId: 'owner-device'});
        let redirected: unknown;
        try {
            await actions.fork({
                params: {slug: 'public-set'},
                request: {formData: async () => forkForm} as unknown as Request
            } as Parameters<typeof actions.fork>[0]);
        } catch (e) {
            redirected = e;
        }
        expect((redirected as { status: number } | undefined)?.status).toBe(303);
        const forkedSlug = (redirected as { location: string }).location.replace('/edit/', '');

        // The owner now lands on the fork's own edit page (still their device).
        const result = await load({
            params: {slug: forkedSlug},
            cookies: {get: () => 'owner-device'}
        } as unknown as Parameters<typeof load>[0]);

        // It must NOT claim to be the original, and must not offer to fork
        // again — this is the bug: previously isFork didn't exist and
        // offerFork was `true` purely from isOwner, so the freshly-forked
        // "... (kopia)" set still showed "To oryginalny zestaw."
        expect(result!.isFork).toBe(true);
        expect(result!.offerFork).toBe(false);
        expect(result!.set.title).toBe('Original title (kopia)');
    });

    it('actions.save still lets the real owner save their own set', async () => {
        const {actions} = await import('./+page.server');

        const ownerForm = makeFormData({
            title: 'Updated by owner',
            isPublic: 'on',
            questions: JSON.stringify([
                {
                    sentence1: 'He is happy.',
                    sentence2WithGap: 'He ______ happy.',
                    keyword: 'be',
                    correctAnswer: 'is',
                    alternativeAnswers: [],
                    exampleWrongAnswers: [],
                    grammarTags: [],
                    minWords: 1,
                    maxWords: 1
                }
            ]),
            deviceId: 'owner-device'
        });

        await actions.save({
            params: {slug: 'public-set'},
            request: {formData: async () => ownerForm} as unknown as Request,
            cookies: {get: () => undefined}
        } as unknown as Parameters<typeof actions.save>[0]);

        const {getSetBySlugOrCustom} = await import('$lib/server/repo/sets');
        const afterSave = getSetBySlugOrCustom('public-set');
        expect(afterSave?.title).toBe('Updated by owner');
    });

    it('load() does NOT fork a public set for a logged-in admin, even though their device id does not match the owner', async () => {
        const {load} = await import('./+page.server');
        const {createAdminSession, ADMIN_COOKIE_NAME} = await import('$lib/server/adminAuth');
        const adminToken = createAdminSession();

        const result = await load({
            params: {slug: 'public-set'},
            cookies: {
                get: (name: string) => (name === ADMIN_COOKIE_NAME ? adminToken : 'not-the-owner-device')
            }
        } as unknown as Parameters<typeof load>[0]);

        // No redirect thrown: the admin lands directly on the original,
        // exactly what the fork-prevention test above asserts does NOT
        // happen for a plain visitor with the same mismatched device id.
        expect(result!.set.title).toBe('Original title');
        expect(result!.isAdmin).toBe(true);
        expect(result!.isOwner).toBe(false);

        const {getSetBySlugOrCustom} = await import('$lib/server/repo/sets');
        // Still exactly one set in the database — nothing got forked.
        expect(getSetBySlugOrCustom('public-set')?.id).toBe(1);
    });

    it('actions.save lets a logged-in admin edit a public set they do not own, in place', async () => {
        const {actions} = await import('./+page.server');
        const {createAdminSession, ADMIN_COOKIE_NAME} = await import('$lib/server/adminAuth');
        const adminToken = createAdminSession();

        const adminForm = makeFormData({
            title: 'Corrected by admin',
            isPublic: 'on',
            questions: JSON.stringify([
                {
                    sentence1: 'He is happy.',
                    sentence2WithGap: 'He ______ happy.',
                    keyword: 'be',
                    correctAnswer: 'is',
                    alternativeAnswers: [],
                    exampleWrongAnswers: [],
                    grammarTags: [],
                    minWords: 1,
                    maxWords: 1
                }
            ]),
            // The admin's browser has no matching "quiet account" device id
            // for this set — the admin session cookie is what authorizes
            // this save, not the deviceId field.
            deviceId: 'not-the-owner-device'
        });

        const result = await actions.save({
            params: {slug: 'public-set'},
            request: {formData: async () => adminForm} as unknown as Request,
            cookies: {
                get: (name: string) => (name === ADMIN_COOKIE_NAME ? adminToken : undefined)
            }
        } as unknown as Parameters<typeof actions.save>[0]);

        expect((result as { status?: number } | undefined)?.status).toBeUndefined();

        const {getSetBySlugOrCustom} = await import('$lib/server/repo/sets');
        const afterSave = getSetBySlugOrCustom('public-set');
        // Edited in place: same id, new title. Ownership is untouched — the
        // admin doesn't become the set's creator just by editing it.
        expect(afterSave?.id).toBe(1);
        expect(afterSave?.title).toBe('Corrected by admin');
        expect(afterSave?.creatorDeviceId).toBe('owner-device');
    });

    it('actions.save still rejects a non-admin, non-owner request even when it claims an admin-shaped cookie value', async () => {
        const {actions} = await import('./+page.server');

        const maliciousForm = makeFormData({
            title: 'HACKED',
            isPublic: 'on',
            questions: JSON.stringify([
                {
                    sentence1: 'x',
                    sentence2WithGap: 'y ______ z',
                    keyword: 'k',
                    correctAnswer: 'defaced',
                    alternativeAnswers: [],
                    exampleWrongAnswers: [],
                    grammarTags: [],
                    minWords: 1,
                    maxWords: 1
                }
            ]),
            deviceId: 'attacker-device'
        });

        const result = await actions.save({
            params: {slug: 'public-set'},
            request: {formData: async () => maliciousForm} as unknown as Request,
            // A forged-looking cookie value that was never issued by
            // createAdminSession() must not validate — sessions are checked
            // against the admin_sessions table, not pattern-matched.
            cookies: {get: () => 'forged-token-that-was-never-issued'}
        } as unknown as Parameters<typeof actions.save>[0]);

        expect((result as { status?: number } | undefined)?.status).toBe(403);

        const {getSetBySlugOrCustom} = await import('$lib/server/repo/sets');
        const afterAttempt = getSetBySlugOrCustom('public-set');
        expect(afterAttempt?.title).toBe('Original title');
    });
});
