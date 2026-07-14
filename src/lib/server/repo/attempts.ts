import { db } from '../db';
import type { Attempt, Question } from '$lib/types';
import { isAnswerCorrect } from '../answerUtils';
import { generateAttemptSlug } from './slug';
import { getQuestionsForSet } from './questions';

interface AttemptRow {
	id: number;
	set_id: number;
	slug: string;
	score: number;
	total: number;
	created_at: string;
}

function toAttempt(row: AttemptRow): Attempt {
	return {
		id: row.id,
		setId: row.set_id,
		slug: row.slug,
		score: row.score,
		total: row.total,
		createdAt: row.created_at
	};
}

export interface GivenAnswer {
	questionId: number;
	given: string;
}

export interface GradedAnswer {
	question: Question;
	given: string;
	isCorrect: boolean;
}

/**
 * Grades a full exam submission and stores the attempt. This never touches
 * question_progress — exam mode is a checkpoint, not a study session (see
 * spec 4.2), so it must not interfere with the Leitner schedule.
 */
export function submitExamAttempt(setId: number, given: GivenAnswer[]): { attempt: Attempt; graded: GradedAnswer[] } {
	const questions = getQuestionsForSet(setId);
	const byId = new Map(questions.map((q) => [q.id, q]));

	const graded: GradedAnswer[] = given
		.map(({ questionId, given }) => {
			const question = byId.get(questionId);
			if (!question) return null;
			const isCorrect = isAnswerCorrect(given, {
				correctAnswer: question.correctAnswer,
				alternativeAnswers: question.alternativeAnswers
			});
			return { question, given, isCorrect };
		})
		.filter((g): g is GradedAnswer => !!g);

	const score = graded.filter((g) => g.isCorrect).length;
	const slug = generateAttemptSlug();

	const insertAttempt = db.prepare(
		'INSERT INTO attempts (set_id, slug, score, total) VALUES (?, ?, ?, ?)'
	);
	const insertAnswer = db.prepare(
		'INSERT INTO answers (attempt_id, question_id, given, is_correct) VALUES (?, ?, ?, ?)'
	);

	const attemptId = db.transaction(() => {
		const result = insertAttempt.run(setId, slug, score, graded.length);
		const id = result.lastInsertRowid as number;
		for (const g of graded) {
			insertAnswer.run(id, g.question.id, g.given, g.isCorrect ? 1 : 0);
		}
		return id;
	})();

	const attemptRow = db.prepare('SELECT * FROM attempts WHERE id = ?').get(attemptId) as AttemptRow;
	return { attempt: toAttempt(attemptRow), graded };
}

export interface AttemptResult {
	attempt: Attempt;
	answers: { questionId: number; given: string | null; isCorrect: boolean }[];
}

export function getAttemptBySlug(slug: string): AttemptResult | null {
	const attemptRow = db.prepare('SELECT * FROM attempts WHERE slug = ?').get(slug) as
		| AttemptRow
		| undefined;
	if (!attemptRow) return null;

	const answerRows = db
		.prepare('SELECT question_id, given, is_correct FROM answers WHERE attempt_id = ?')
		.all(attemptRow.id) as { question_id: number; given: string | null; is_correct: number }[];

	return {
		attempt: toAttempt(attemptRow),
		answers: answerRows.map((a) => ({
			questionId: a.question_id,
			given: a.given,
			isCorrect: !!a.is_correct
		}))
	};
}
