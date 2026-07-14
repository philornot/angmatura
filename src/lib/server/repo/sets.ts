import { db } from '../db';
import type { SetSummary, SetType } from '$lib/types';
import { generateUniqueSlug } from './slug';

interface SetRow {
	id: number;
	slug: string;
	title: string;
	source_label: string | null;
	type: SetType;
	is_public: number;
	is_featured: number;
	parent_slug: string | null;
	created_at: string;
	question_count: number;
}

function toSummary(row: SetRow): SetSummary {
	return {
		id: row.id,
		slug: row.slug,
		title: row.title,
		sourceLabel: row.source_label,
		type: row.type,
		isPublic: !!row.is_public,
		isFeatured: !!row.is_featured,
		parentSlug: row.parent_slug,
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

export function getSetBySlug(slug: string): SetSummary | null {
	const row = db.prepare(`${WITH_COUNT_SELECT} WHERE slug = ?`).get(slug) as SetRow | undefined;
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
}

export function createSet(input: NewSetInput): SetSummary {
	const slug = generateUniqueSlug(input.title);
	const result = db
		.prepare(
			`INSERT INTO sets (slug, title, source_label, type, is_public, is_featured, parent_slug)
			 VALUES (?, ?, ?, ?, ?, ?, ?)`
		)
		.run(
			slug,
			input.title,
			input.sourceLabel ?? null,
			input.type,
			input.isPublic ? 1 : 0,
			input.isFeatured ? 1 : 0,
			input.parentSlug ?? null
		);
	return getSetById(result.lastInsertRowid as number)!;
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

export function deleteSet(id: number) {
	db.prepare('DELETE FROM sets WHERE id = ?').run(id);
}

export function groupSetsByType(sets: SetSummary[]): Record<SetType, SetSummary[]> {
	const groups: Record<SetType, SetSummary[]> = { kwt: [], grammar: [], translation: [] };
	for (const set of sets) groups[set.type].push(set);
	return groups;
}
