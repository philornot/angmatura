/**
 * Answer comparison utilities.
 *
 * Correct answers may contain optional fragments written in parentheses, e.g.
 *   "so noisy outside (that)"
 * meaning both "so noisy outside that" and "so noisy outside" should be
 * accepted. There can be more than one such group in a single answer, in
 * which case every combination of included/excluded groups is a valid
 * surface form.
 */

function normalizeWhitespace(s: string): string {
	return s.replace(/\s+/g, ' ').trim();
}

function normalizeForComparison(s: string): string {
	return normalizeWhitespace(s)
		.toLowerCase()
		.replace(/[\u2019\u2018]/g, "'")
		.replace(/[\u201C\u201D]/g, '"')
		.replace(/[.,!?;:]+$/g, ''); // ignore trailing punctuation only
}

/** Expands "so noisy outside (that)" into all accepted surface variants. */
export function expandOptionalVariants(answer: string): string[] {
	const matches = [...answer.matchAll(/\s*\(([^)]*)\)/g)];
	if (matches.length === 0) return [normalizeWhitespace(answer)];

	// Cap combinations for safety; realistic answers have 0-2 optional groups.
	const groups = matches.slice(0, 8);
	const variants = new Set<string>();
	const n = groups.length;

	for (let mask = 0; mask < 1 << n; mask++) {
		let variant = answer;
		// Replace from the end so earlier match indices stay valid.
		for (let i = n - 1; i >= 0; i--) {
			const match = groups[i];
			const include = (mask >> i) & 1;
			const replacement = include ? ` ${match[1]}` : '';
			variant = variant.slice(0, match.index) + replacement + variant.slice((match.index ?? 0) + match[0].length);
		}
		variants.add(normalizeWhitespace(variant));
	}
	return [...variants];
}

export interface AnswerKey {
	correctAnswer: string;
	alternativeAnswers: string[];
}

/** Checks a student's answer against the correct answer + alternatives. */
export function isAnswerCorrect(given: string, key: AnswerKey): boolean {
	if (!given?.trim()) return false;
	const candidates = [key.correctAnswer, ...key.alternativeAnswers].flatMap(expandOptionalVariants);
	const normalizedCandidates = new Set(candidates.map(normalizeForComparison));
	return normalizedCandidates.has(normalizeForComparison(given));
}

export function countWords(s: string): number {
	return s.trim().length === 0 ? 0 : s.trim().split(/\s+/).length;
}
