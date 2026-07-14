/** Days to wait before a question in a given box becomes due again. */
const INTERVAL_DAYS: Record<number, number> = {
	2: 1,
	3: 3,
	4: 7,
	5: 21
};

export const MAX_BOX = 5;
export const MIN_BOX = 1;

/** Box 1 has no wait — a missed question comes back on the very next review session. */
export function nextBox(currentBox: number, wasCorrect: boolean): number {
	if (!wasCorrect) return MIN_BOX;
	return Math.min(currentBox + 1, MAX_BOX);
}

export function nextDueAt(box: number, from: Date = new Date()): Date {
	if (box <= MIN_BOX) return from;
	const days = INTERVAL_DAYS[box] ?? 1;
	return new Date(from.getTime() + days * 24 * 60 * 60 * 1000);
}
