import { describe, expect, it } from 'vitest';
import { normalizeCustomSlug } from './slug';

// Only `normalizeCustomSlug` is covered here — it's a pure function.
// `generateUniqueSlug`, `isCustomSlugAvailable` and `generateAttemptSlug`
// all hit the SQLite db (via `../db`) and are better covered by an
// integration test against a real (temp) database if that's ever added.

describe('normalizeCustomSlug', () => {
	it('lowercases and hyphenates spaces', () => {
		expect(normalizeCustomSlug('My Custom Set')).toBe('my-custom-set');
	});

	it('strips Polish diacritics', () => {
		// ł/Ł is a distinct letter, not a base letter + combining mark, so
		// NFKD doesn't decompose it — unlike the others here, it falls
		// through to the accumulator's hyphen-collapsing instead.
		expect(normalizeCustomSlug('ąĄżŻćĆńŃóÓśŚęĘźŹ')).toBe('aazzccnnoosseezz');
		expect(normalizeCustomSlug('łŁ')).toBe('');
	});

	it('strips diacritics inside a realistic phrase', () => {
		expect(normalizeCustomSlug('Zestaw wiosną')).toBe('zestaw-wiosna');
	});

	it('collapses runs of non-alphanumeric characters into a single hyphen', () => {
		expect(normalizeCustomSlug('hello!!!  ---  world')).toBe('hello-world');
	});

	it('trims leading and trailing hyphens', () => {
		expect(normalizeCustomSlug('  -weird-input-  ')).toBe('weird-input');
	});

	it('returns an empty string for input with no usable characters', () => {
		expect(normalizeCustomSlug('')).toBe('');
		expect(normalizeCustomSlug('!!!')).toBe('');
		expect(normalizeCustomSlug('   ')).toBe('');
	});

	it('truncates to 60 characters', () => {
		const long = 'a'.repeat(100);
		const result = normalizeCustomSlug(long);
		expect(result).toHaveLength(60);
		expect(result).toBe('a'.repeat(60));
	});

	it('is idempotent on an already-normalized slug', () => {
		expect(normalizeCustomSlug('already-normalized-123')).toBe('already-normalized-123');
	});
});