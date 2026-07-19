import { describe, expect, it } from 'vitest';
import { countWords, expandOptionalVariants, isAnswerCorrect } from './answerUtils';

describe('expandOptionalVariants', () => {
	it('returns the answer unchanged when there are no parentheses', () => {
		expect(expandOptionalVariants('so noisy outside')).toEqual(['so noisy outside']);
	});

	it('expands a single optional group into two variants', () => {
		const variants = expandOptionalVariants('so noisy outside (that)');
		expect(variants).toHaveLength(2);
		expect(variants).toContain('so noisy outside that');
		expect(variants).toContain('so noisy outside');
	});

	it('expands two optional groups into four variants', () => {
		const variants = expandOptionalVariants('it (really) is (very) cold');
		expect(variants).toHaveLength(4);
		expect(variants).toContain('it really is very cold');
		expect(variants).toContain('it really is cold');
		expect(variants).toContain('it is very cold');
		expect(variants).toContain('it is cold');
	});

	it('expands three optional groups into eight variants without dropping/misaligning text', () => {
		const variants = expandOptionalVariants('a (b) c (d) e (f) g');
		expect(variants).toHaveLength(8);
		expect(variants).toContain('a b c d e f g');
		expect(variants).toContain('a c e g');
		expect(variants).toContain('a b c d e g');
	});

	it('normalizes internal whitespace in every produced variant', () => {
		const variants = expandOptionalVariants('so   noisy   outside (that)');
		expect(variants).toContain('so noisy outside that');
		expect(variants).toContain('so noisy outside');
	});
});

describe('isAnswerCorrect', () => {
	const key = { correctAnswer: 'so noisy outside (that)', alternativeAnswers: ["it's fine"] };

	it('accepts the full form including the optional fragment', () => {
		expect(isAnswerCorrect('so noisy outside that', key)).toBe(true);
	});

	it('accepts the form with the optional fragment omitted', () => {
		expect(isAnswerCorrect('so noisy outside', key)).toBe(true);
	});

	it('is case-insensitive', () => {
		expect(isAnswerCorrect('SO NOISY OUTSIDE', key)).toBe(true);
	});

	it('ignores trailing punctuation', () => {
		expect(isAnswerCorrect('so noisy outside.', key)).toBe(true);
		expect(isAnswerCorrect('so noisy outside!', key)).toBe(true);
	});

	it('treats curly and straight apostrophes as equivalent', () => {
		expect(isAnswerCorrect("it’s fine", key)).toBe(true);
		expect(isAnswerCorrect("it's fine", key)).toBe(true);
	});

	it('accepts alternative answers', () => {
		expect(isAnswerCorrect("it's fine", key)).toBe(true);
	});

	it('rejects an empty answer', () => {
		expect(isAnswerCorrect('', key)).toBe(false);
		expect(isAnswerCorrect('   ', key)).toBe(false);
	});

	it('rejects a wrong answer', () => {
		expect(isAnswerCorrect('totally different', key)).toBe(false);
	});
});

describe('countWords', () => {
	it('returns 0 for an empty or whitespace-only string', () => {
		expect(countWords('')).toBe(0);
		expect(countWords('   ')).toBe(0);
	});

	it('counts single and multiple words', () => {
		expect(countWords('hello')).toBe(1);
		expect(countWords('hello world')).toBe(2);
	});

	it('collapses extra whitespace between words', () => {
		expect(countWords('hello    world   again')).toBe(3);
	});
});