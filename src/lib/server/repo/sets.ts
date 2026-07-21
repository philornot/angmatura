import {db} from '../db';
import type {SetSummary, SetType} from '$lib/types';
import {generateUniqueSlug, isCustomSlugAvailable, normalizeCustomSlug} from './slug';

interface SetRow {
	id: number;
	slug: string;
	custom_slug: string | null;
	title: string;
	source_label: string | null;
	type: SetType;
	is_public: number;
	is_featured: number;
	parent_slug: string | null;
	creator_device_id: string | null;
	deleted_at: string | null;
	created_at: string;
	question_count: number;
}

function toSummary(row: SetRow): SetSummary {
	return {
		id: row.id,
		slug: row.slug,
		customSlug: row.custom_slug,
		title: row.title,
		sourceLabel: row.source_label,
		type: row.type,
		isPublic: !!row.is_public,
		isFeatured: !!row.is_featured,
		parentSlug: row.parent_slug,
		creatorDeviceId: row.creator_device_id,
		deletedAt: row.deleted_at,
		createdAt: row.created_at,
		questionCount: row.question_count
	};
}

const WITH_COUNT_SELECT = `
	SELECT sets.*, (SELECT COUNT(*) FROM questions WHERE questions.set_id = sets.id) AS question_count
	FROM sets
`;

export function getPublicSets(): SetSummary[] {
	const rows = db
		.prepare(`${WITH_COUNT_SELECT} WHERE is_public = 1 AND deleted_at IS NULL ORDER BY created_at DESC`)
		.all() as SetRow[];
	return rows.map(toSummary);
}

export function getFeaturedSets(): SetSummary[] {
	const rows = db
		.prepare(
			`${WITH_COUNT_SELECT} WHERE is_public = 1 AND is_featured = 1 AND deleted_at IS NULL ORDER BY created_at DESC`
		)
		.all() as SetRow[];
	return rows.map(toSummary);
}

/** All *live* (non-trashed) sets — what the admin's main list shows. Trashed
 *  sets have their own list, `getTrashedSets()`, shown at /admin/trash. */
export function getAllSets(): SetSummary[] {
	const rows = db
		.prepare(`${WITH_COUNT_SELECT} WHERE deleted_at IS NULL ORDER BY created_at DESC`)
		.all() as SetRow[];
	return rows.map(toSummary);
}

/**
 * Returns every set created from `deviceId`'s browser (the "quiet account"
 * system — see `$lib/deviceId`), newest first. Includes both public and
 * private sets, since ownership — not visibility — is what matters here.
 * A blank/missing deviceId always yields an empty list rather than every
 * ownerless set, since `creator_device_id IS NULL` is "unknown owner", not
 * "owned by nobody in particular". Trashed sets are excluded — once a user
 * deletes their own set it should disappear from "my sets" immediately, even
 * though it's only hard-deleted 30 days later.
 */
export function getSetsByCreator(deviceId: string | null | undefined): SetSummary[] {
	if (!deviceId) return [];
	const rows = db
		.prepare(`${WITH_COUNT_SELECT} WHERE creator_device_id = ? AND deleted_at IS NULL ORDER BY created_at DESC`)
		.all(deviceId) as SetRow[];
	return rows.map(toSummary);
}


/** Looks up a set by its permanent random slug only (used by /edit, which always operates on the canonical link). Excludes trashed sets — a deleted set's edit link should behave as "not found", same as any other visitor-facing lookup. */
export function getSetBySlug(slug: string): SetSummary | null {
	const row = db.prepare(`${WITH_COUNT_SELECT} WHERE slug = ? AND deleted_at IS NULL`).get(slug) as
		| SetRow
		| undefined;
	return row ? toSummary(row) : null;
}

/** Looks up a set by either its permanent random slug OR its admin-assigned custom slug — both links resolve to the same set. Excludes trashed sets. */
export function getSetBySlugOrCustom(slug: string): SetSummary | null {
	const row = db
		.prepare(`${WITH_COUNT_SELECT} WHERE (slug = ? OR custom_slug = ?) AND deleted_at IS NULL`)
		.get(slug, slug) as SetRow | undefined;
	return row ? toSummary(row) : null;
}

/** Looks up a set by id regardless of trash status — used internally (e.g.
 *  by `updateSetMeta`/`softDeleteSet`/`restoreSet`) and by the admin trash
 *  screen, which needs to find trashed sets by id too. */
export function getSetById(id: number): SetSummary | null {
	const row = db.prepare(`${WITH_COUNT_SELECT} WHERE sets.id = ?`).get(id) as SetRow | undefined;
	return row ? toSummary(row) : null;
}

export interface NewSetInput {
	title: string;
	sourceLabel?: string | null;
	type: SetType;
	isPublic?: boolean;
	isFeatured?: boolean;
	parentSlug?: string | null;
	/** Anonymous device id of whoever created this set (see `$lib/deviceId`).
	 *  Lets that same device edit the set in place later without forking —
	 *  the "quiet account" system. Null/omitted for sets with no known owner. */
	creatorDeviceId?: string | null;
}

export function createSet(input: NewSetInput): SetSummary {
	const slug = generateUniqueSlug();
	const result = db
		.prepare(
			`INSERT INTO sets (slug, title, source_label, type, is_public, is_featured, parent_slug, creator_device_id)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
		)
		.run(
			slug,
			input.title,
			input.sourceLabel ?? null,
			input.type,
			input.isPublic ? 1 : 0,
			input.isFeatured ? 1 : 0,
			input.parentSlug ?? null,
			input.creatorDeviceId ?? null
		);
	return getSetById(result.lastInsertRowid as number)!;
}

/** True if `deviceId` is a non-empty id matching this set's recorded creator. */
export function isSetOwner(set: SetSummary, deviceId: string | null | undefined): boolean {
	return !!deviceId && !!set.creatorDeviceId && set.creatorDeviceId === deviceId;
}

export function updateSetMeta(
	id: number,
	patch: Partial<Pick<NewSetInput, 'title' | 'sourceLabel' | 'isPublic' | 'isFeatured'>>
) {
	const current = getSetById(id);
	if (!current) throw new Error('Set not found');
	db.prepare(`UPDATE sets SET title = ?, source_label = ?, is_public = ?, is_featured = ? WHERE id = ?`).run(
		patch.title ?? current.title,
		patch.sourceLabel !== undefined ? patch.sourceLabel : current.sourceLabel,
		patch.isPublic !== undefined ? (patch.isPublic ? 1 : 0) : current.isPublic ? 1 : 0,
		patch.isFeatured !== undefined ? (patch.isFeatured ? 1 : 0) : current.isFeatured ? 1 : 0,
		id
	);
}

export type SetCustomSlugResult =
	| { ok: true; customSlug: string | null }
	| { ok: false; error: 'not_public' | 'invalid' | 'taken' };

/**
 * Assigns (or clears, with `raw = null`) a custom link for a set. Only
 * published (public) sets can have a custom link — an admin publishing a set
 * later can still add one afterwards, but a private set cannot.
 */
export function setCustomSlug(id: number, raw: string | null): SetCustomSlugResult {
	const current = getSetById(id);
	if (!current) return { ok: false, error: 'invalid' };

	if (raw === null || raw.trim() === '') {
		db.prepare('UPDATE sets SET custom_slug = NULL WHERE id = ?').run(id);
		return { ok: true, customSlug: null };
	}

	if (!current.isPublic) return { ok: false, error: 'not_public' };

	const normalized = normalizeCustomSlug(raw);
	if (!normalized) return { ok: false, error: 'invalid' };
	if (!isCustomSlugAvailable(normalized, id)) return { ok: false, error: 'taken' };

	db.prepare('UPDATE sets SET custom_slug = ? WHERE id = ?').run(normalized, id);
	return { ok: true, customSlug: normalized };
}

/** Hard delete — permanently removes the row (and, via ON DELETE CASCADE,
 *  its questions/attempts). Not reachable from the normal "my sets" delete
 *  button anymore; only used by the trash's permanent-purge job and by the
 *  admin's "delete forever" action on an already-trashed set. */
export function deleteSet(id: number) {
	db.prepare('DELETE FROM sets WHERE id = ?').run(id);
}

/** How long a soft-deleted set sits in the trash before it's eligible for
 *  permanent purging. Matches the product spec: "30 days in the trash". */
export const TRASH_RETENTION_DAYS = 30;

export type SoftDeleteResult = { ok: true } | { ok: false; error: 'not_found' | 'forbidden' };

/**
 * Moves a set to the trash instead of deleting it outright ("Usuń" button on
 * /my-sets). Only the set's own creator device may do this — mirrors the
 * ownership check `actions.save` already does in /edit, since a set's slug
 * isn't secret for public sets.
 */
export function softDeleteSet(id: number, deviceId: string | null | undefined): SoftDeleteResult {
	const current = getSetById(id);
	if (!current) return {ok: false, error: 'not_found'};
	if (!isSetOwner(current, deviceId)) return {ok: false, error: 'forbidden'};

	db.prepare(`UPDATE sets
	            SET deleted_at = CURRENT_TIMESTAMP
	            WHERE id = ?`).run(id);
	return {ok: true};
}

/** Moves a set to the trash with no ownership check — only for the admin
 *  panel's "Usuń" action, which is allowed to trash *any* set, not just
 *  ones it happens to "own". Kept separate from `softDeleteSet` so that
 *  function's owner check can never be accidentally bypassed by a caller
 *  that forgets to pass a deviceId. */
export function trashSetAsAdmin(id: number): { ok: boolean } {
	const current = getSetById(id);
	if (!current) return {ok: false};
	db.prepare(`UPDATE sets
	            SET deleted_at = CURRENT_TIMESTAMP
	            WHERE id = ?`).run(id);
	return {ok: true};
}

/** Pulls a set back out of the trash (admin-only, from /admin/trash). Clears
 *  `deleted_at`; everything else about the set (public/featured flags,
 *  custom slug, etc.) is left exactly as it was when it was trashed, so the
 *  admin can then re-publish/re-feature it as a separate, deliberate step. */
export function restoreSet(id: number): void {
	db.prepare(`UPDATE sets
	            SET deleted_at = NULL
	            WHERE id = ?`).run(id);
}

/** Everything currently sitting in the trash, newest-deleted first — feeds
 *  the /admin/trash screen. */
export function getTrashedSets(): SetSummary[] {
	const rows = db
		.prepare(`${WITH_COUNT_SELECT} WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC`)
		.all() as SetRow[];
	return rows.map(toSummary);
}

/**
 * Permanently deletes every trashed set whose `deleted_at` is older than
 * `TRASH_RETENTION_DAYS`. Intended to be called opportunistically (e.g. once
 * whenever the admin trash screen loads) rather than needing a real cron —
 * this app has no background job runner, so "check on next relevant page
 * load" is the pragmatic equivalent. Returns how many were purged, mostly
 * for logging/tests.
 */
export function purgeExpiredTrash(): number {
	const result = db
		.prepare(
			`DELETE
			 FROM sets
			 WHERE deleted_at IS NOT NULL
			   AND deleted_at <= datetime('now', ?)`
		)
		.run(`-${TRASH_RETENTION_DAYS} days`);
	return result.changes;
}

export function groupSetsByType(sets: SetSummary[]): Record<SetType, SetSummary[]> {
	const groups: Record<SetType, SetSummary[]> = { kwt: [], grammar: [], translation: [] };
	for (const set of sets) groups[set.type].push(set);
	return groups;
}
