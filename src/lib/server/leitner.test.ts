import { describe, expect, it } from 'vitest';
import { MAX_BOX, MIN_BOX, nextBox, nextDueAt } from './leitner';

describe('nextBox', () => {
	it('sends any box back to MIN_BOX on a wrong answer', () => {
		for (let box = MIN_BOX; box <= MAX_BOX; box++) {
			expect(nextBox(box, false)).toBe(MIN_BOX);
		}
	});

	it('advances one box on a correct answer', () => {
		expect(nextBox(1, true)).toBe(2);
		expect(nextBox(2, true)).toBe(3);
		expect(nextBox(3, true)).toBe(4);
		expect(nextBox(4, true)).toBe(5);
	});

	it('caps at MAX_BOX on a correct answer from the last box', () => {
		expect(nextBox(MAX_BOX, true)).toBe(MAX_BOX);
	});
});

describe('nextDueAt', () => {
	const from = new Date('2026-01-01T00:00:00.000Z');

	it('is due immediately for box 1 (no wait)', () => {
		expect(nextDueAt(1, from).getTime()).toBe(from.getTime());
	});

	it('is also immediately due for boxes below MIN_BOX, just in case', () => {
		expect(nextDueAt(0, from).getTime()).toBe(from.getTime());
	});

	it('waits 1 day for box 2', () => {
		const due = nextDueAt(2, from);
		expect(due.getTime() - from.getTime()).toBe(1 * 24 * 60 * 60 * 1000);
	});

	it('waits 3 days for box 3', () => {
		const due = nextDueAt(3, from);
		expect(due.getTime() - from.getTime()).toBe(3 * 24 * 60 * 60 * 1000);
	});

	it('waits 7 days for box 4', () => {
		const due = nextDueAt(4, from);
		expect(due.getTime() - from.getTime()).toBe(7 * 24 * 60 * 60 * 1000);
	});

	it('waits 21 days for box 5', () => {
		const due = nextDueAt(5, from);
		expect(due.getTime() - from.getTime()).toBe(21 * 24 * 60 * 60 * 1000);
	});

	it('defaults to "now" when no reference date is given', () => {
		const before = Date.now();
		const due = nextDueAt(1);
		const after = Date.now();
		expect(due.getTime()).toBeGreaterThanOrEqual(before);
		expect(due.getTime()).toBeLessThanOrEqual(after);
	});
});