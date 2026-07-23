import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import Database from 'better-sqlite3';
import {initSchema} from '$lib/server/schema';

// Integration test against a real (in-memory) SQLite database — same
// pattern as `bulk.test.ts` and the edit-page test. Covers both ways a set
// can legitimately land in the trash through this endpoint: the anonymous
// "quiet account" owner check (deviceId in the request body) and, since the
// admin panel's edit-in-place feature needs it too, an authenticated admin
// session trashing a set they don't own.
let testDb: Database.Database;

function fakeCookies(token: string | undefined) {
    return {get: () => token} as unknown as import('@sveltejs/kit').Cookies;
}

function jsonRequest(body: unknown): Request {
    return {json: async () => body} as unknown as Request;
}

beforeEach(() => {
    vi.resetModules();
    testDb = new Database(':memory:');
    testDb.pragma('foreign_keys = ON');
    initSchema(testDb);
    vi.doMock('$lib/server/db', () => ({db: testDb}));

    testDb
        .prepare(
            `INSERT INTO sets (id, slug, title, type, is_public, creator_device_id)
             VALUES (1, 'owned-set', 'Owned set', 'kwt', 1, 'owner-device')`
        )
        .run();
});

afterEach(() => {
    testDb.close();
    vi.doUnmock('$lib/server/db');
});

async function authedAdminCookies() {
    const {createAdminSession} = await import('$lib/server/adminAuth');
    return fakeCookies(createAdminSession());
}

describe('POST /api/sets/[id]/trash', () => {
    it("trashes the set when the caller's deviceId matches the recorded owner", async () => {
        const {POST} = await import('./+server');

        const response = await POST({
            params: {id: '1'},
            request: jsonRequest({deviceId: 'owner-device'}),
            cookies: fakeCookies(undefined)
        } as unknown as Parameters<typeof POST>[0]);

        expect(response.status).toBe(200);

        const {getSetById} = await import('$lib/server/repo/sets');
        expect(getSetById(1)?.deletedAt).not.toBeNull();
    });

    it('rejects a mismatched deviceId with no admin session, leaving the set untouched', async () => {
        const {POST} = await import('./+server');

        let thrown: unknown;
        try {
            await POST({
                params: {id: '1'},
                request: jsonRequest({deviceId: 'someone-else'}),
                cookies: fakeCookies(undefined)
            } as unknown as Parameters<typeof POST>[0]);
        } catch (e) {
            thrown = e;
        }

        expect((thrown as { status?: number } | undefined)?.status).toBe(403);

        const {getSetById} = await import('$lib/server/repo/sets');
        expect(getSetById(1)?.deletedAt).toBeNull();
    });

    it('lets a logged-in admin trash a set they do not own, without needing a matching deviceId', async () => {
        const {POST} = await import('./+server');
        const adminCookies = await authedAdminCookies();

        const response = await POST({
            params: {id: '1'},
            // No deviceId at all — the admin session alone must be enough,
            // mirroring how the "Usuń zestaw" button on /edit/[slug] calls
            // this endpoint for a set the admin doesn't own.
            request: jsonRequest({}),
            cookies: adminCookies
        } as unknown as Parameters<typeof POST>[0]);

        expect(response.status).toBe(200);

        const {getSetById} = await import('$lib/server/repo/sets');
        expect(getSetById(1)?.deletedAt).not.toBeNull();
    });

    it('returns 404 for a set id that does not exist, even with a valid admin session', async () => {
        const {POST} = await import('./+server');
        const adminCookies = await authedAdminCookies();

        let thrown: unknown;
        try {
            await POST({
                params: {id: '999'},
                request: jsonRequest({}),
                cookies: adminCookies
            } as unknown as Parameters<typeof POST>[0]);
        } catch (e) {
            thrown = e;
        }

        expect((thrown as { status?: number } | undefined)?.status).toBe(404);
    });

    it('rejects a forged-looking cookie value that was never issued by createAdminSession()', async () => {
        const {POST} = await import('./+server');

        let thrown: unknown;
        try {
            await POST({
                params: {id: '1'},
                request: jsonRequest({deviceId: 'someone-else'}),
                cookies: fakeCookies('forged-token-that-was-never-issued')
            } as unknown as Parameters<typeof POST>[0]);
        } catch (e) {
            thrown = e;
        }

        expect((thrown as { status?: number } | undefined)?.status).toBe(403);

        const {getSetById} = await import('$lib/server/repo/sets');
        expect(getSetById(1)?.deletedAt).toBeNull();
    });
});
