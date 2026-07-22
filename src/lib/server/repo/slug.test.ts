import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import Database from 'better-sqlite3';
import {initSchema} from '$lib/server/schema';

// Integration tests against a real (in-memory) SQLite database — same
// pattern as `progress.test.ts` and the edit-page test. The soft-delete
// ("trash") system touches enough different queries (public listing, "my
// sets", direct slug lookup, admin listing) that a pure unit test of one
// function wouldn't catch a query that forgot to exclude deleted_at.
let testDb: Database.Database;

beforeEach(() => {
	vi.resetModules();
	testDb = new Database(':memory:');
	testDb.pragma('foreign_keys = ON');
	initSchema(testDb);
	vi.doMock('$lib/server/db', () => ({db: testDb}));

	testDb
		.prepare(
			`INSERT INTO sets (id, slug, title, type, is_public, creator_device_id)
			 VALUES (1, 'set-one', 'First set', 'kwt', 1, 'owner-device')`
		)
		.run();
	testDb
		.prepare(
			`INSERT INTO sets (id, slug, title, type, is_public, creator_device_id)
			 VALUES (2, 'set-two', 'Second set', 'kwt', 0, 'other-device')`
		)
		.run();
});

afterEach(() => {
	testDb.close();
	vi.doUnmock('$lib/server/db');
});

describe('softDeleteSet', () => {
	it("lets the owner move their own set to the trash", async () => {
		const {softDeleteSet, getSetById} = await import('./sets');

		const result = softDeleteSet(1, 'owner-device');

		expect(result.ok).toBe(true);
		expect(getSetById(1)?.deletedAt).not.toBeNull();
	});

	it('refuses to trash a set for someone who is not its owner', async () => {
		const {softDeleteSet, getSetById} = await import('./sets');

		const result = softDeleteSet(1, 'someone-else');

		expect(result.ok).toBe(false);
		expect(getSetById(1)?.deletedAt).toBeNull();
	});

	it('refuses when no deviceId is supplied at all (public API caller with no id)', async () => {
		const {softDeleteSet} = await import('./sets');

		const result = softDeleteSet(1, null);

		expect(result.ok).toBe(false);
	});

	it('reports not_found for a nonexistent set id', async () => {
		const {softDeleteSet} = await import('./sets');

		const result = softDeleteSet(9999, 'owner-device');

		expect(result).toEqual({ok: false, error: 'not_found'});
	});
});

describe('trashSetAsAdmin', () => {
	it('trashes any set regardless of ownership', async () => {
		const {trashSetAsAdmin, getSetById} = await import('./sets');

		const result = trashSetAsAdmin(2);

		expect(result.ok).toBe(true);
		expect(getSetById(2)?.deletedAt).not.toBeNull();
	});
});

describe('trashed sets are hidden from every normal-facing query', () => {
	it('disappears from getPublicSets, getAllSets, and getSetsByCreator once trashed', async () => {
		const {softDeleteSet, getPublicSets, getAllSets, getSetsByCreator, getSetBySlug, getSetBySlugOrCustom} =
			await import('./sets');

		softDeleteSet(1, 'owner-device');

		expect(getPublicSets().find((s) => s.id === 1)).toBeUndefined();
		expect(getAllSets().find((s) => s.id === 1)).toBeUndefined();
		expect(getSetsByCreator('owner-device').find((s) => s.id === 1)).toBeUndefined();
		expect(getSetBySlug('set-one')).toBeNull();
		expect(getSetBySlugOrCustom('set-one')).toBeNull();
	});

	it('is still reachable by id (needed internally, and by the admin trash screen)', async () => {
		const {softDeleteSet, getSetById} = await import('./sets');

		softDeleteSet(1, 'owner-device');

		expect(getSetById(1)).not.toBeNull();
	});
});

describe('getTrashedSets / restoreSet', () => {
	it('lists trashed sets and restoreSet brings them back to normal listings', async () => {
		const {softDeleteSet, restoreSet, getTrashedSets, getAllSets, getSetById} = await import('./sets');

		softDeleteSet(1, 'owner-device');
		expect(getTrashedSets().map((s) => s.id)).toEqual([1]);

		restoreSet(1);

		expect(getSetById(1)?.deletedAt).toBeNull();
		expect(getTrashedSets()).toEqual([]);
		expect(getAllSets().find((s) => s.id === 1)).toBeDefined();
	});
});

describe('purgeExpiredTrash', () => {
	it('permanently removes only sets past the retention window, leaving recent ones alone', async () => {
		const {purgeExpiredTrash, getSetById, TRASH_RETENTION_DAYS} = await import('./sets');

		// Set 1: trashed 31 days ago -> past the 30-day window, should be purged.
		testDb
			.prepare(`UPDATE sets
			          SET deleted_at = datetime('now', ?)
			          WHERE id = 1`)
			.run(`-${TRASH_RETENTION_DAYS + 1} days`);
		// Set 2: trashed just now -> well within the window, should survive.
		testDb.prepare(`UPDATE sets
		                SET deleted_at = CURRENT_TIMESTAMP
		                WHERE id = 2`).run();

		const purgedCount = purgeExpiredTrash();

		expect(purgedCount).toBe(1);
		expect(getSetById(1)).toBeNull();
		expect(getSetById(2)).not.toBeNull();
	});
});
