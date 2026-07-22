import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import Database from 'better-sqlite3';
import {initSchema} from '$lib/server/schema';

// Integration test against a real (in-memory) SQLite database — same
// pattern as `sets.test.ts` and the edit-page test. Exercises the endpoint
// through its actual RequestEvent shape rather than unit-testing the repo
// functions it calls, since the thing worth verifying here is that the
// per-action switch does the right thing for a *mixed* batch (some public,
// some not; some featured, some not).
let testDb: Database.Database;

function fakeCookies(token: string | undefined) {
    return {get: () => token} as unknown as import('@sveltejs/kit').Cookies;
}

function jsonRequest(body: unknown): Request {
    return {json: async () => body} as unknown as Request;
}

beforeEach(async () => {
    vi.resetModules();
    testDb = new Database(':memory:');
    testDb.pragma('foreign_keys = ON');
    initSchema(testDb);
    vi.doMock('$lib/server/db', () => ({db: testDb}));

    testDb
        .prepare(
            `INSERT INTO sets (id, slug, title, type, is_public, is_featured)
             VALUES (1, 'set-a', 'Public unfeatured', 'kwt', 1, 0),
                    (2, 'set-b', 'Public featured', 'kwt', 1, 1),
                    (3, 'set-c', 'Private set', 'kwt', 0, 0)`
        )
        .run();
});

afterEach(() => {
    testDb.close();
    vi.doUnmock('$lib/server/db');
});

async function authedCookies() {
    const {createAdminSession} = await import('$lib/server/adminAuth');
    return fakeCookies(createAdminSession());
}

describe('POST /api/admin/sets/bulk', () => {
    it('rejects the request when the caller has no valid admin session', async () => {
        const {POST} = await import('./+server');

        let thrown: unknown;
        try {
            await POST({
                request: jsonRequest({ids: [1], action: 'publish'}),
                cookies: fakeCookies(undefined)
            } as unknown as Parameters<typeof POST>[0]);
        } catch (e) {
            thrown = e;
        }

        expect((thrown as { status: number }).status).toBe(401);
    });

    it('publish sets isPublic=true for every id, regardless of starting state', async () => {
        const {POST} = await import('./+server');
        const {getSetById} = await import('$lib/server/repo/sets');

        const response = await POST({
            request: jsonRequest({ids: [1, 3], action: 'publish'}),
            cookies: await authedCookies()
        } as unknown as Parameters<typeof POST>[0]);

        expect(response.status).toBe(200);
        expect(getSetById(1)?.isPublic).toBe(true);
        expect(getSetById(3)?.isPublic).toBe(true);
    });

    it('hide sets isPublic=false AND clears isFeatured (a hidden set cannot stay featured)', async () => {
        const {POST} = await import('./+server');
        const {getSetById} = await import('$lib/server/repo/sets');

        const response = await POST({
            request: jsonRequest({ids: [2], action: 'hide'}),
            cookies: await authedCookies()
        } as unknown as Parameters<typeof POST>[0]);

        expect(response.status).toBe(200);
        const set = getSetById(2);
        expect(set?.isPublic).toBe(false);
        expect(set?.isFeatured).toBe(false);
    });

    it('feature skips private sets instead of featuring them, and reports the skip count', async () => {
        const {POST} = await import('./+server');
        const {getSetById} = await import('$lib/server/repo/sets');

        const response = await POST({
            request: jsonRequest({ids: [1, 3], action: 'feature'}),
            cookies: await authedCookies()
        } as unknown as Parameters<typeof POST>[0]);
        const body = await response.json();

        expect(getSetById(1)?.isFeatured).toBe(true); // public -> featured normally
        expect(getSetById(3)?.isFeatured).toBe(false); // private -> skipped, not featured
        expect(body.skipped).toBe(1);
        expect(body.updated).toBe(1);
    });

    it('unfeature clears isFeatured without touching isPublic', async () => {
        const {POST} = await import('./+server');
        const {getSetById} = await import('$lib/server/repo/sets');

        const response = await POST({
            request: jsonRequest({ids: [2], action: 'unfeature'}),
            cookies: await authedCookies()
        } as unknown as Parameters<typeof POST>[0]);

        expect(response.status).toBe(200);
        const set = getSetById(2);
        expect(set?.isFeatured).toBe(false);
        expect(set?.isPublic).toBe(true);
    });

    it('trash moves every listed set to the trash', async () => {
        const {POST} = await import('./+server');
        const {getSetById} = await import('$lib/server/repo/sets');

        const response = await POST({
            request: jsonRequest({ids: [1, 2, 3], action: 'trash'}),
            cookies: await authedCookies()
        } as unknown as Parameters<typeof POST>[0]);

        expect(response.status).toBe(200);
        expect(getSetById(1)?.deletedAt).not.toBeNull();
        expect(getSetById(2)?.deletedAt).not.toBeNull();
        expect(getSetById(3)?.deletedAt).not.toBeNull();
    });

    it('restore clears deleted_at for every listed (trashed) set', async () => {
        const {POST} = await import('./+server');
        const {getSetById, trashSetAsAdmin} = await import('$lib/server/repo/sets');

        trashSetAsAdmin(1);
        trashSetAsAdmin(2);

        const response = await POST({
            request: jsonRequest({ids: [1, 2], action: 'restore'}),
            cookies: await authedCookies()
        } as unknown as Parameters<typeof POST>[0]);

        expect(response.status).toBe(200);
        expect(getSetById(1)?.deletedAt).toBeNull();
        expect(getSetById(2)?.deletedAt).toBeNull();
    });

    it('destroy permanently removes every listed set (irreversible)', async () => {
        const {POST} = await import('./+server');
        const {getSetById, trashSetAsAdmin} = await import('$lib/server/repo/sets');

        trashSetAsAdmin(1);
        trashSetAsAdmin(3);

        const response = await POST({
            request: jsonRequest({ids: [1, 3], action: 'destroy'}),
            cookies: await authedCookies()
        } as unknown as Parameters<typeof POST>[0]);

        expect(response.status).toBe(200);
        expect(getSetById(1)).toBeNull();
        expect(getSetById(3)).toBeNull();
        // Set 2 was never in the batch — it must survive untouched.
        expect(getSetById(2)).not.toBeNull();
    });

    it('rejects an empty ids list and an unknown action', async () => {
        const {POST} = await import('./+server');
        const cookies = await authedCookies();

        let emptyIdsError: unknown;
        try {
            await POST({request: jsonRequest({ids: [], action: 'publish'}), cookies} as unknown as Parameters<
                typeof POST
            >[0]);
        } catch (e) {
            emptyIdsError = e;
        }
        expect((emptyIdsError as { status: number }).status).toBe(400);

        let badActionError: unknown;
        try {
            await POST({request: jsonRequest({ids: [1], action: 'nuke'}), cookies} as unknown as Parameters<
                typeof POST
            >[0]);
        } catch (e) {
            badActionError = e;
        }
        expect((badActionError as { status: number }).status).toBe(400);
    });
});
