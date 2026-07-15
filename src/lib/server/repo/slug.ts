import { db } from '../db';

const RANDOM_SLUG_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';
const RANDOM_SLUG_LENGTH = 8;

function randomSlug(): string {
	let out = '';
	for (let i = 0; i < RANDOM_SLUG_LENGTH; i++) {
		out += RANDOM_SLUG_ALPHABET[Math.floor(Math.random() * RANDOM_SLUG_ALPHABET.length)];
	}
	return out;
}

/**
 * Generates a random short id for a set's permanent link, e.g. "a1b2c3d4".
 * Not derived from the title — the title can change without breaking the
 * link. Checked against both `slug` and `custom_slug` so a random id can
 * never collide with a custom link an admin has already assigned.
 */
export function generateUniqueSlug(): string {
	const exists = db.prepare('SELECT 1 FROM sets WHERE slug = ? OR custom_slug = ?');
	for (let attempt = 0; attempt < 20; attempt++) {
		const candidate = randomSlug();
		if (!exists.get(candidate, candidate)) return candidate;
	}
	// Astronomically unlikely fallback.
	return `${randomSlug()}-${Date.now().toString(36)}`;
}

/** Normalizes a custom slug candidate: lowercase, ascii, hyphenated. */
export function normalizeCustomSlug(raw: string): string {
	return raw
		.trim()
		.toLowerCase()
		.normalize('NFKD')
		.replace(/[\u0300-\u036f]/g, '') // strip accents (ą, ł, etc.)
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 60);
}

/** Returns true if the given custom slug is free to use (optionally ignoring one set's own current value). */
export function isCustomSlugAvailable(customSlug: string, ignoreSetId?: number): boolean {
	const row = db
		.prepare('SELECT id FROM sets WHERE slug = ? OR custom_slug = ?')
		.get(customSlug, customSlug) as { id: number } | undefined;
	return !row || row.id === ignoreSetId;
}

export function generateAttemptSlug(): string {
	const exists = db.prepare('SELECT 1 FROM attempts WHERE slug = ?');
	for (let attempt = 0; attempt < 20; attempt++) {
		const candidate = Math.random().toString(36).slice(2, 10);
		if (!exists.get(candidate)) return candidate;
	}
	return `${Date.now()}`;
}
