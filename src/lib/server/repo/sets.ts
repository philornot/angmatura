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
		.prepare(`${WITH_COUNT_SELECT} WHERE is_public = 1 ORDER BY created_at DESC`)
		.all() as SetRow[];
	return rows.map(toSummary);
}

export function getFeaturedSets(): SetSummary[] {
	const rows = db
		.prepare(`${WITH_COUNT_SELECT} WHERE is_public = 1 AND is_featured = 1 ORDER BY created_at DESC`)
		.all() as SetRow[];
	return rows.map(toSummary);
}

export function getAllSets(): SetSummary[] {
	const rows = db.prepare(`${WITH_COUNT_SELECT} ORDER BY created_at DESC`).all() as SetRow[];
	return rows.map(toSummary);
}

/** Looks up a set by its permanent random slug only (used by /edit, which always operates on the canonical link). */
export function getSetBySlug(slug: string): SetSummary | null {
	const row = db.prepare(`${WITH_COUNT_SELECT} WHERE slug = ?`).get(slug) as SetRow | undefined;
	return row ? toSummary(row) : null;
}

/** Looks up a set by either its permanent random slug OR its admin-assigned custom slug — both links resolve to the same set. */
export function getSetBySlugOrCustom(slug: string): SetSummary | null {
	const row = db
		.prepare(`${WITH_COUNT_SELECT} WHERE slug = ? OR custom_slug = ?`)
		.get(slug, slug) as SetRow | undefined;
	return row ? toSummary(row) : null;
}

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

export function deleteSet(id: number) {
	db.prepare('DELETE FROM sets WHERE id = ?').run(id);
}

export function groupSetsByType(sets: SetSummary[]): Record<SetType, SetSummary[]> {
	const groups: Record<SetType, SetSummary[]> = { kwt: [], grammar: [], translation: [] };
	for (const set of sets) groups[set.type].push(set);
	return groups;
}
