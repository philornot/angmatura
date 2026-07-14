import { db } from '../db';

function slugify(title: string): string {
	return (
		title
			.toLowerCase()
			.normalize('NFKD')
			.replace(/[\u0300-\u036f]/g, '') // strip accents (ą, ł, etc.)
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '')
			.slice(0, 60) || 'zestaw'
	);
}

/** Generates a URL slug from a title, appending a short random suffix if needed to stay unique. */
export function generateUniqueSlug(title: string): string {
	const base = slugify(title);
	const exists = db.prepare('SELECT 1 FROM sets WHERE slug = ?');

	if (!exists.get(base)) return base;

	for (let attempt = 0; attempt < 20; attempt++) {
		const suffix = Math.random().toString(36).slice(2, 6);
		const candidate = `${base}-${suffix}`;
		if (!exists.get(candidate)) return candidate;
	}
	// Astronomically unlikely fallback.
	return `${base}-${Date.now()}`;
}

export function generateAttemptSlug(): string {
	const exists = db.prepare('SELECT 1 FROM attempts WHERE slug = ?');
	for (let attempt = 0; attempt < 20; attempt++) {
		const candidate = Math.random().toString(36).slice(2, 10);
		if (!exists.get(candidate)) return candidate;
	}
	return `${Date.now()}`;
}
